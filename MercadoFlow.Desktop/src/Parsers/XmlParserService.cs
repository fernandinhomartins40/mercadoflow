using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Xml;
using System.Xml.Linq;
using System.Xml.Schema;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MercadoFlow.Desktop.Configuration;
using MercadoFlow.Desktop.Models;
using MercadoFlow.Desktop.Models.DTOs;

namespace MercadoFlow.Desktop.Parsers;

public class XmlParserService : IXmlParserService
{
    private readonly ILogger<XmlParserService> _logger;
    private readonly SecuritySettings _securitySettings;
    private readonly PerformanceSettings _performanceSettings;

    // Namespaces NFe
    private static readonly XNamespace NfeNamespace = "http://www.portalfiscal.inf.br/nfe";
    private static readonly XNamespace NfceNamespace = "http://www.portalfiscal.inf.br/nfe";
    private static readonly XNamespace SigNamespace = "http://www.w3.org/2000/09/xmldsig#";

    // Regex para validações
    private static readonly Regex ChaveNFeRegex = new(@"\d{44}", RegexOptions.Compiled);
    private static readonly Regex CnpjRegex = new(@"\d{14}", RegexOptions.Compiled);
    private static readonly Regex CpfRegex = new(@"\d{11}", RegexOptions.Compiled);

    public XmlParserService(
        ILogger<XmlParserService> logger,
        IOptions<SecuritySettings> securitySettings,
        IOptions<PerformanceSettings> performanceSettings)
    {
        _logger = logger;
        _securitySettings = securitySettings.Value;
        _performanceSettings = performanceSettings.Value;
    }

    public async Task<ParsingResult> ParseXmlAsync(string xmlContent, string fileName)
    {
        var stopwatch = Stopwatch.StartNew();
        var result = new ParsingResult
        {
            FileName = fileName,
            FileSizeBytes = Encoding.UTF8.GetByteCount(xmlContent)
        };

        try
        {
            _logger.LogDebug("Iniciando parse do XML {FileName}", fileName);

            // Detectar tipo e versão do documento
            result.DocumentType = DetectDocumentType(xmlContent);
            result.Version = DetectXmlVersion(xmlContent);

            if (result.DocumentType == DocumentType.Unknown)
            {
                result.ErrorMessage = "Tipo de documento não reconhecido";
                return result;
            }

            // Validar XML se habilitado
            if (_securitySettings.ValidateXmlSchema)
            {
                var validationResult = await ValidateXmlAsync(xmlContent);
                if (!validationResult.IsValid)
                {
                    result.ErrorMessage = $"XML inválido: {string.Join(", ", validationResult.Errors.Select(e => e.Message))}";
                    return result;
                }
            }

            // Gerar hash do XML
            result.RawXmlHash = GenerateXmlHash(xmlContent);

            // Parse do documento
            var xdoc = XDocument.Parse(xmlContent);
            result.InvoiceData = await ParseInvoiceDataAsync(xdoc, result.DocumentType, result.Version);

            if (result.InvoiceData != null)
            {
                result.Success = true;
                _logger.LogInformation("XML {FileName} processado com sucesso. Chave: {ChaveNFe}",
                    fileName, result.InvoiceData.ChaveNFe);
            }
            else
            {
                result.ErrorMessage = "Falha ao extrair dados da nota fiscal";
            }
        }
        catch (XmlException ex)
        {
            result.ErrorMessage = $"XML malformado: {ex.Message}";
            _logger.LogError(ex, "Erro de XML malformado no arquivo {FileName}", fileName);
        }
        catch (Exception ex)
        {
            result.ErrorMessage = $"Erro inesperado: {ex.Message}";
            _logger.LogError(ex, "Erro inesperado ao processar XML {FileName}", fileName);
        }
        finally
        {
            stopwatch.Stop();
            result.ProcessingTime = stopwatch.Elapsed;
        }

        return result;
    }

    public async Task<ParsingResult> ParseXmlFileAsync(string filePath)
    {
        try
        {
            if (!File.Exists(filePath))
            {
                return new ParsingResult
                {
                    FileName = Path.GetFileName(filePath),
                    ErrorMessage = "Arquivo não encontrado"
                };
            }

            var fileInfo = new FileInfo(filePath);
            if (fileInfo.Length > _performanceSettings.MaxQueueSize * 1024 * 1024) // Converter para bytes
            {
                return new ParsingResult
                {
                    FileName = fileInfo.Name,
                    ErrorMessage = "Arquivo muito grande"
                };
            }

            var xmlContent = await File.ReadAllTextAsync(filePath, Encoding.UTF8);
            var result = await ParseXmlAsync(xmlContent, fileInfo.Name);
            result.FileSizeBytes = fileInfo.Length;

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao ler arquivo XML {FilePath}", filePath);
            return new ParsingResult
            {
                FileName = Path.GetFileName(filePath),
                ErrorMessage = $"Erro ao ler arquivo: {ex.Message}"
            };
        }
    }

    public async Task<ValidationResult> ValidateXmlAsync(string xmlContent)
    {
        var result = new ValidationResult();

        try
        {
            // Validação básica de estrutura XML
            var xdoc = XDocument.Parse(xmlContent);

            // Verificar assinatura digital se habilitado
            if (_securitySettings.ValidateXmlSignature)
            {
                result.HasValidSignature = ValidateXmlSignature(xdoc);
            }

            // TODO: Implementar validação contra XSD da Receita Federal
            // Por ora, apenas validação básica de estrutura
            result.PassedSchemaValidation = true;
            result.IsValid = true;

            _logger.LogDebug("Validação de XML concluída com sucesso");
        }
        catch (XmlException ex)
        {
            result.Errors.Add(new ValidationError
            {
                Field = "XML",
                Message = $"XML malformado: {ex.Message}",
                Code = "XML_MALFORMED"
            });
            _logger.LogWarning("XML inválido detectado: {Message}", ex.Message);
        }
        catch (Exception ex)
        {
            result.Errors.Add(new ValidationError
            {
                Field = "Validation",
                Message = $"Erro na validação: {ex.Message}",
                Code = "VALIDATION_ERROR"
            });
            _logger.LogError(ex, "Erro inesperado durante validação");
        }

        return result;
    }

    public bool IsValidNFeXml(string xmlContent)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(xmlContent))
                return false;

            var xdoc = XDocument.Parse(xmlContent);
            var root = xdoc.Root;

            // Verificar se é NFe ou NFCe
            return root?.Name.LocalName == "nfeProc" ||
                   root?.Name.LocalName == "NFe" ||
                   root?.Descendants().Any(x => x.Name.LocalName == "infNFe") == true;
        }
        catch
        {
            return false;
        }
    }

    public XmlVersion DetectXmlVersion(string xmlContent)
    {
        try
        {
            var xdoc = XDocument.Parse(xmlContent);
            var infNfe = xdoc.Descendants().FirstOrDefault(x => x.Name.LocalName == "infNFe");

            if (infNfe != null)
            {
                var versao = infNfe.Attribute("versao")?.Value;
                return versao switch
                {
                    "3.10" => XmlVersion.Version310,
                    "4.00" => XmlVersion.Version400,
                    _ => XmlVersion.Unknown
                };
            }

            return XmlVersion.Unknown;
        }
        catch
        {
            return XmlVersion.Unknown;
        }
    }

    public DocumentType DetectDocumentType(string xmlContent)
    {
        try
        {
            var xdoc = XDocument.Parse(xmlContent);
            var root = xdoc.Root;

            if (root?.Name.LocalName == "nfeProc" ||
                root?.Descendants().Any(x => x.Name.LocalName == "infNFe") == true)
            {
                // Verificar se é NFCe pela presença do campo tpAmb e mod = 65
                var ide = xdoc.Descendants().FirstOrDefault(x => x.Name.LocalName == "ide");
                var mod = ide?.Element(ide.Name.Namespace + "mod")?.Value;

                return mod == "65" ? DocumentType.NFCe : DocumentType.NFe;
            }

            return DocumentType.Unknown;
        }
        catch
        {
            return DocumentType.Unknown;
        }
    }

    private async Task<InvoiceDto?> ParseInvoiceDataAsync(XDocument xdoc, DocumentType docType, XmlVersion version)
    {
        try
        {
            var infNfe = xdoc.Descendants().FirstOrDefault(x => x.Name.LocalName == "infNFe");
            if (infNfe == null)
                return null;

            var ns = infNfe.Name.Namespace;
            var ide = infNfe.Element(ns + "ide");
            var emit = infNfe.Element(ns + "emit");
            var dest = infNfe.Element(ns + "dest");
            var total = infNfe.Element(ns + "total");
            var det = infNfe.Elements(ns + "det");
            var pag = infNfe.Element(ns + "pag");

            var invoice = new InvoiceDto
            {
                ChaveNFe = infNfe.Attribute("Id")?.Value?.Replace("NFe", "").Replace("nfe", "") ?? string.Empty,
                Serie = ide?.Element(ns + "serie")?.Value ?? string.Empty,
                Numero = ide?.Element(ns + "nNF")?.Value ?? string.Empty,
                DataEmissao = ParseDateTime(ide?.Element(ns + "dhEmi")?.Value),
                CnpjEmitente = emit?.Element(ns + "CNPJ")?.Value ?? string.Empty,
                NomeEmitente = emit?.Element(ns + "xNome")?.Value,
                MunicipioEmitente = emit?.Element(ns + "enderEmit")?.Element(ns + "xMun")?.Value,
                UfEmitente = emit?.Element(ns + "enderEmit")?.Element(ns + "UF")?.Value,
                NaturezaOperacao = ide?.Element(ns + "natOp")?.Value,
                TipoOperacao = ide?.Element(ns + "tpNF")?.Value == "0" ? "Entrada" : "Saída",
                VersaoXml = version.ToString(),
                TipoAmbiente = ide?.Element(ns + "tpAmb")?.Value == "1" ? "Produção" : "Homologação",
                ProcessedAt = DateTime.UtcNow
            };

            // Dados do destinatário
            if (dest != null)
            {
                invoice.CpfCnpjDestinatario = dest.Element(ns + "CNPJ")?.Value ?? dest.Element(ns + "CPF")?.Value;
                invoice.NomeDestinatario = dest.Element(ns + "xNome")?.Value;
                var enderDest = dest.Element(ns + "enderDest");
                if (enderDest != null)
                {
                    invoice.MunicipioDestinatario = enderDest.Element(ns + "xMun")?.Value;
                    invoice.UfDestinatario = enderDest.Element(ns + "UF")?.Value;
                }
            }

            // Totais
            if (total != null)
            {
                var icmsTot = total.Element(ns + "ICMSTot");
                if (icmsTot != null)
                {
                    invoice.ValorTotal = ParseDecimal(icmsTot.Element(ns + "vNF")?.Value);
                    invoice.ValorProdutos = ParseDecimal(icmsTot.Element(ns + "vProd")?.Value);
                    invoice.ValorIcms = ParseDecimal(icmsTot.Element(ns + "vICMS")?.Value);
                    invoice.ValorIpi = ParseDecimal(icmsTot.Element(ns + "vIPI")?.Value);
                    invoice.ValorPis = ParseDecimal(icmsTot.Element(ns + "vPIS")?.Value);
                    invoice.ValorCofins = ParseDecimal(icmsTot.Element(ns + "vCOFINS")?.Value);
                    invoice.ValorDesconto = ParseDecimal(icmsTot.Element(ns + "vDesc")?.Value);
                    invoice.ValorFrete = ParseDecimal(icmsTot.Element(ns + "vFrete")?.Value);
                }
            }

            // Itens
            foreach (var item in det)
            {
                var invoiceItem = ParseInvoiceItem(item, ns);
                if (invoiceItem != null)
                {
                    invoice.Items.Add(invoiceItem);
                }
            }

            // Pagamentos (para NFCe)
            if (pag != null)
            {
                var detPag = pag.Elements(ns + "detPag");
                foreach (var pagamento in detPag)
                {
                    var paymentInfo = ParsePaymentInfo(pagamento, ns);
                    if (paymentInfo != null)
                    {
                        invoice.Payments.Add(paymentInfo);
                    }
                }
            }

            return invoice;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao fazer parse dos dados da invoice");
            return null;
        }
    }

    private InvoiceItemDto? ParseInvoiceItem(XElement det, XNamespace ns)
    {
        try
        {
            var prod = det.Element(ns + "prod");
            var imposto = det.Element(ns + "imposto");

            if (prod == null)
                return null;

            var item = new InvoiceItemDto
            {
                NumeroItem = int.Parse(det.Attribute("nItem")?.Value ?? "0"),
                CodigoEAN = prod.Element(ns + "cEAN")?.Value,
                CodigoInterno = prod.Element(ns + "cProd")?.Value ?? string.Empty,
                Descricao = prod.Element(ns + "xProd")?.Value ?? string.Empty,
                Ncm = prod.Element(ns + "NCM")?.Value ?? string.Empty,
                Cfop = prod.Element(ns + "CFOP")?.Value ?? string.Empty,
                UnidadeComercial = prod.Element(ns + "uCom")?.Value ?? string.Empty,
                Quantidade = ParseDecimal(prod.Element(ns + "qCom")?.Value),
                ValorUnitario = ParseDecimal(prod.Element(ns + "vUnCom")?.Value),
                ValorTotal = ParseDecimal(prod.Element(ns + "vProd")?.Value),
                ValorDesconto = ParseDecimal(prod.Element(ns + "vDesc")?.Value)
            };

            // Parse de impostos
            if (imposto != null)
            {
                ParseTaxes(item, imposto, ns);
            }

            return item;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao fazer parse do item");
            return null;
        }
    }

    private void ParseTaxes(InvoiceItemDto item, XElement imposto, XNamespace ns)
    {
        // ICMS
        var icms = imposto.Element(ns + "ICMS")?.Elements().FirstOrDefault();
        if (icms != null)
        {
            item.AliquotaIcms = ParseDecimal(icms.Element(ns + "pICMS")?.Value);
            item.ValorIcms = ParseDecimal(icms.Element(ns + "vICMS")?.Value);
            item.CstIcms = icms.Element(ns + "CST")?.Value ?? icms.Element(ns + "CSOSN")?.Value;
        }

        // IPI
        var ipi = imposto.Element(ns + "IPI")?.Element(ns + "IPITrib");
        if (ipi != null)
        {
            item.AliquotaIpi = ParseDecimal(ipi.Element(ns + "pIPI")?.Value);
            item.ValorIpi = ParseDecimal(ipi.Element(ns + "vIPI")?.Value);
            item.CstIpi = ipi.Element(ns + "CST")?.Value;
        }

        // PIS
        var pis = imposto.Element(ns + "PIS")?.Elements().FirstOrDefault();
        if (pis != null)
        {
            item.AliquotaPis = ParseDecimal(pis.Element(ns + "pPIS")?.Value);
            item.ValorPis = ParseDecimal(pis.Element(ns + "vPIS")?.Value);
            item.CstPis = pis.Element(ns + "CST")?.Value;
        }

        // COFINS
        var cofins = imposto.Element(ns + "COFINS")?.Elements().FirstOrDefault();
        if (cofins != null)
        {
            item.AliquotaCofins = ParseDecimal(cofins.Element(ns + "pCOFINS")?.Value);
            item.ValorCofins = ParseDecimal(cofins.Element(ns + "vCOFINS")?.Value);
            item.CstCofins = cofins.Element(ns + "CST")?.Value;
        }
    }

    private PaymentInfoDto? ParsePaymentInfo(XElement detPag, XNamespace ns)
    {
        try
        {
            return new PaymentInfoDto
            {
                FormaPagamento = detPag.Element(ns + "tPag")?.Value ?? string.Empty,
                Valor = ParseDecimal(detPag.Element(ns + "vPag")?.Value),
                MeioPagamento = detPag.Element(ns + "indPag")?.Value,
                BandeiraCartao = detPag.Element(ns + "card")?.Element(ns + "tBand")?.Value,
                NumeroAutorizacao = detPag.Element(ns + "card")?.Element(ns + "cAut")?.Value
            };
        }
        catch
        {
            return null;
        }
    }

    private bool ValidateXmlSignature(XDocument xdoc)
    {
        try
        {
            // TODO: Implementar validação real da assinatura digital
            // Por ora, apenas verificar se existe elemento de assinatura
            var signature = xdoc.Descendants(SigNamespace + "Signature").Any();
            return signature;
        }
        catch
        {
            return false;
        }
    }

    private string GenerateXmlHash(string xmlContent)
    {
        using var sha256 = SHA256.Create();
        var hashBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(xmlContent));
        return Convert.ToHexString(hashBytes);
    }

    private static DateTime ParseDateTime(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return DateTime.MinValue;

        if (DateTime.TryParse(value, out var result))
            return result;

        return DateTime.MinValue;
    }

    private static decimal ParseDecimal(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return 0;

        // Normalizar formato brasileiro/internacional
        value = value.Replace(',', '.');

        if (decimal.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var result))
            return result;

        return 0;
    }
}