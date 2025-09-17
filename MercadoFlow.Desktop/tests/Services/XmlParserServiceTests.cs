using System;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;
using MercadoFlow.Desktop.Configuration;
using MercadoFlow.Desktop.Parsers;
using MercadoFlow.Desktop.Models;

namespace MercadoFlow.Desktop.Tests.Services;

public class XmlParserServiceTests
{
    private readonly Mock<ILogger<XmlParserService>> _mockLogger;
    private readonly Mock<IOptions<SecuritySettings>> _mockSecuritySettings;
    private readonly Mock<IOptions<PerformanceSettings>> _mockPerformanceSettings;
    private readonly XmlParserService _xmlParserService;

    public XmlParserServiceTests()
    {
        _mockLogger = new Mock<ILogger<XmlParserService>>();

        _mockSecuritySettings = new Mock<IOptions<SecuritySettings>>();
        _mockSecuritySettings.Setup(x => x.Value).Returns(new SecuritySettings
        {
            ValidateXmlSchema = false,
            ValidateXmlSignature = false
        });

        _mockPerformanceSettings = new Mock<IOptions<PerformanceSettings>>();
        _mockPerformanceSettings.Setup(x => x.Value).Returns(new PerformanceSettings
        {
            MaxQueueSize = 10
        });

        _xmlParserService = new XmlParserService(
            _mockLogger.Object,
            _mockSecuritySettings.Object,
            _mockPerformanceSettings.Object);
    }

    [Fact]
    public async Task ParseXmlAsync_ValidNFeXml_ReturnsSuccessResult()
    {
        // Arrange
        var validXml = CreateValidNFeXml();
        var fileName = "test.xml";

        // Act
        var result = await _xmlParserService.ParseXmlAsync(validXml, fileName);

        // Assert
        Assert.True(result.Success);
        Assert.NotNull(result.InvoiceData);
        Assert.Equal("12345678901234567890123456789012345678901234", result.InvoiceData.ChaveNFe);
        Assert.Equal("Test Company", result.InvoiceData.NomeEmitente);
    }

    [Fact]
    public async Task ParseXmlAsync_InvalidXml_ReturnsErrorResult()
    {
        // Arrange
        var invalidXml = "<invalid>xml</content>";
        var fileName = "invalid.xml";

        // Act
        var result = await _xmlParserService.ParseXmlAsync(invalidXml, fileName);

        // Assert
        Assert.False(result.Success);
        Assert.NotNull(result.ErrorMessage);
    }

    [Theory]
    [InlineData("4.00", XmlVersion.Version400)]
    [InlineData("3.10", XmlVersion.Version310)]
    [InlineData("2.00", XmlVersion.Unknown)]
    public void DetectXmlVersion_ReturnsCorrectVersion(string version, XmlVersion expected)
    {
        // Arrange
        var xml = $@"<?xml version=""1.0"" encoding=""UTF-8""?>
            <nfeProc xmlns=""http://www.portalfiscal.inf.br/nfe"">
                <NFe>
                    <infNFe versao=""{version}"">
                        <ide>
                            <cUF>35</cUF>
                        </ide>
                    </infNFe>
                </NFe>
            </nfeProc>";

        // Act
        var result = _xmlParserService.DetectXmlVersion(xml);

        // Assert
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("55", DocumentType.NFe)]
    [InlineData("65", DocumentType.NFCe)]
    public void DetectDocumentType_ReturnsCorrectType(string modelo, DocumentType expected)
    {
        // Arrange
        var xml = $@"<?xml version=""1.0"" encoding=""UTF-8""?>
            <nfeProc xmlns=""http://www.portalfiscal.inf.br/nfe"">
                <NFe>
                    <infNFe versao=""4.00"">
                        <ide>
                            <mod>{modelo}</mod>
                        </ide>
                    </infNFe>
                </NFe>
            </nfeProc>";

        // Act
        var result = _xmlParserService.DetectDocumentType(xml);

        // Assert
        Assert.Equal(expected, result);
    }

    [Fact]
    public void IsValidNFeXml_ValidXml_ReturnsTrue()
    {
        // Arrange
        var validXml = CreateValidNFeXml();

        // Act
        var result = _xmlParserService.IsValidNFeXml(validXml);

        // Assert
        Assert.True(result);
    }

    [Fact]
    public void IsValidNFeXml_InvalidXml_ReturnsFalse()
    {
        // Arrange
        var invalidXml = "<html><body>Not an NFe</body></html>";

        // Act
        var result = _xmlParserService.IsValidNFeXml(invalidXml);

        // Assert
        Assert.False(result);
    }

    private static string CreateValidNFeXml()
    {
        return @"<?xml version=""1.0"" encoding=""UTF-8""?>
<nfeProc xmlns=""http://www.portalfiscal.inf.br/nfe"">
    <NFe>
        <infNFe versao=""4.00"" Id=""NFe12345678901234567890123456789012345678901234"">
            <ide>
                <cUF>35</cUF>
                <cNF>12345678</cNF>
                <natOp>Venda</natOp>
                <mod>55</mod>
                <serie>1</serie>
                <nNF>123</nNF>
                <dhEmi>2024-01-01T10:00:00-03:00</dhEmi>
                <tpNF>1</tpNF>
                <idDest>1</idDest>
                <cMunFG>3550308</cMunFG>
                <tpImp>1</tpImp>
                <tpEmis>1</tpEmis>
                <cDV>7</cDV>
                <tpAmb>2</tpAmb>
                <finNFe>1</finNFe>
                <indFinal>1</indFinal>
                <indPres>1</indPres>
            </ide>
            <emit>
                <CNPJ>12345678000195</CNPJ>
                <xNome>Test Company</xNome>
                <enderEmit>
                    <xLgr>Rua Teste</xLgr>
                    <nro>123</nro>
                    <xBairro>Centro</xBairro>
                    <cMun>3550308</cMun>
                    <xMun>São Paulo</xMun>
                    <UF>SP</UF>
                    <CEP>01234567</CEP>
                </enderEmit>
                <IE>123456789</IE>
            </emit>
            <dest>
                <CPF>12345678901</CPF>
                <xNome>Cliente Teste</xNome>
                <enderDest>
                    <xLgr>Rua Cliente</xLgr>
                    <nro>456</nro>
                    <xBairro>Bairro</xBairro>
                    <cMun>3550308</cMun>
                    <xMun>São Paulo</xMun>
                    <UF>SP</UF>
                    <CEP>98765432</CEP>
                </enderDest>
            </dest>
            <det nItem=""1"">
                <prod>
                    <cProd>001</cProd>
                    <cEAN>1234567890123</cEAN>
                    <xProd>Produto Teste</xProd>
                    <NCM>12345678</NCM>
                    <CFOP>5102</CFOP>
                    <uCom>UN</uCom>
                    <qCom>1.0000</qCom>
                    <vUnCom>10.00</vUnCom>
                    <vProd>10.00</vProd>
                    <cEANTrib>1234567890123</cEANTrib>
                    <uTrib>UN</uTrib>
                    <qTrib>1.0000</qTrib>
                    <vUnTrib>10.00</vUnTrib>
                </prod>
                <imposto>
                    <ICMS>
                        <ICMS00>
                            <orig>0</orig>
                            <CST>00</CST>
                            <modBC>3</modBC>
                            <vBC>10.00</vBC>
                            <pICMS>18.00</pICMS>
                            <vICMS>1.80</vICMS>
                        </ICMS00>
                    </ICMS>
                    <PIS>
                        <PISAliq>
                            <CST>01</CST>
                            <vBC>10.00</vBC>
                            <pPIS>1.65</pPIS>
                            <vPIS>0.17</vPIS>
                        </PISAliq>
                    </PIS>
                    <COFINS>
                        <COFINSAliq>
                            <CST>01</CST>
                            <vBC>10.00</vBC>
                            <pCOFINS>7.60</pCOFINS>
                            <vCOFINS>0.76</vCOFINS>
                        </COFINSAliq>
                    </COFINS>
                </imposto>
            </det>
            <total>
                <ICMSTot>
                    <vBC>10.00</vBC>
                    <vICMS>1.80</vICMS>
                    <vICMSDeson>0.00</vICMSDeson>
                    <vFCP>0.00</vFCP>
                    <vBCST>0.00</vBCST>
                    <vST>0.00</vST>
                    <vFCPST>0.00</vFCPST>
                    <vFCPSTRet>0.00</vFCPSTRet>
                    <vProd>10.00</vProd>
                    <vFrete>0.00</vFrete>
                    <vSeg>0.00</vSeg>
                    <vDesc>0.00</vDesc>
                    <vII>0.00</vII>
                    <vIPI>0.00</vIPI>
                    <vIPIDevol>0.00</vIPIDevol>
                    <vPIS>0.17</vPIS>
                    <vCOFINS>0.76</vCOFINS>
                    <vOutro>0.00</vOutro>
                    <vNF>10.00</vNF>
                </ICMSTot>
            </total>
        </infNFe>
    </NFe>
</nfeProc>";
    }
}