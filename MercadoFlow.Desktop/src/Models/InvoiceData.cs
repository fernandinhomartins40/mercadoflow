using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace MercadoFlow.Desktop.Models;

public class InvoiceData
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    [StringLength(44)]
    public string ChaveNFe { get; set; } = string.Empty;

    [Required]
    public string MarketId { get; set; } = string.Empty;

    public string? PdvId { get; set; }

    [Required]
    public string Serie { get; set; } = string.Empty;

    [Required]
    public string Numero { get; set; } = string.Empty;

    [Required]
    public DateTime DataEmissao { get; set; }

    [Required]
    [StringLength(14)]
    public string CnpjEmitente { get; set; } = string.Empty;

    public string? CpfCnpjDestinatario { get; set; }

    [Required]
    public decimal ValorTotal { get; set; }

    public string? RawXmlHash { get; set; }

    [Required]
    public DateTime ProcessedAt { get; set; } = DateTime.UtcNow;

    public string? NomeEmitente { get; set; }

    public string? InscricaoEstadualEmitente { get; set; }

    public string? EnderecoEmitente { get; set; }

    public string? MunicipioEmitente { get; set; }

    public string? UfEmitente { get; set; }

    public string? CepEmitente { get; set; }

    public string? NomeDestinatario { get; set; }

    public string? EnderecoDestinatario { get; set; }

    public string? MunicipioDestinatario { get; set; }

    public string? UfDestinatario { get; set; }

    public string? CepDestinatario { get; set; }

    public decimal? BaseCalculoIcms { get; set; }

    public decimal? ValorIcms { get; set; }

    public decimal? BaseCalculoIcmsSt { get; set; }

    public decimal? ValorIcmsSt { get; set; }

    public decimal? ValorProdutos { get; set; }

    public decimal? ValorFrete { get; set; }

    public decimal? ValorSeguro { get; set; }

    public decimal? ValorDesconto { get; set; }

    public decimal? ValorII { get; set; }

    public decimal? ValorIpi { get; set; }

    public decimal? ValorPis { get; set; }

    public decimal? ValorCofins { get; set; }

    public decimal? OutrasDespesas { get; set; }

    public string? InformacoesAdicionais { get; set; }

    public string? TipoOperacao { get; set; }

    public string? NaturezaOperacao { get; set; }

    public string? FormaPagamento { get; set; }

    public string? VersaoXml { get; set; }

    public string? TipoAmbiente { get; set; }

    public string? StatusNfe { get; set; }

    public DateTime? DataAutorizacao { get; set; }

    public string? ProtocoloAutorizacao { get; set; }

    public virtual ICollection<InvoiceItem> Items { get; set; } = new List<InvoiceItem>();

    public virtual ICollection<PaymentInfo> Payments { get; set; } = new List<PaymentInfo>();
}