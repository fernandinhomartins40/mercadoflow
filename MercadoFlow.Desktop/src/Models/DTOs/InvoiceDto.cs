using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace MercadoFlow.Desktop.Models.DTOs;

public class InvoiceDto
{
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
    public string CnpjEmitente { get; set; } = string.Empty;

    public string? CpfCnpjDestinatario { get; set; }

    [Required]
    public decimal ValorTotal { get; set; }

    public string? NomeEmitente { get; set; }

    public string? NomeDestinatario { get; set; }

    public string? MunicipioEmitente { get; set; }

    public string? UfEmitente { get; set; }

    public string? MunicipioDestinatario { get; set; }

    public string? UfDestinatario { get; set; }

    public decimal? ValorProdutos { get; set; }

    public decimal? ValorIcms { get; set; }

    public decimal? ValorIpi { get; set; }

    public decimal? ValorPis { get; set; }

    public decimal? ValorCofins { get; set; }

    public decimal? ValorDesconto { get; set; }

    public decimal? ValorFrete { get; set; }

    public string? NaturezaOperacao { get; set; }

    public string? TipoOperacao { get; set; }

    public string? VersaoXml { get; set; }

    public string? TipoAmbiente { get; set; }

    public DateTime? DataAutorizacao { get; set; }

    public string? ProtocoloAutorizacao { get; set; }

    [Required]
    public DateTime ProcessedAt { get; set; } = DateTime.UtcNow;

    public List<InvoiceItemDto> Items { get; set; } = new();

    public List<PaymentInfoDto> Payments { get; set; } = new();

    public Dictionary<string, object>? Metadata { get; set; }
}

public class InvoiceItemDto
{
    [Required]
    public int NumeroItem { get; set; }

    public string? CodigoEAN { get; set; }

    [Required]
    public string CodigoInterno { get; set; } = string.Empty;

    [Required]
    public string Descricao { get; set; } = string.Empty;

    [Required]
    public string Ncm { get; set; } = string.Empty;

    [Required]
    public string Cfop { get; set; } = string.Empty;

    [Required]
    public string UnidadeComercial { get; set; } = string.Empty;

    [Required]
    public decimal Quantidade { get; set; }

    [Required]
    public decimal ValorUnitario { get; set; }

    [Required]
    public decimal ValorTotal { get; set; }

    public decimal? ValorDesconto { get; set; }

    public decimal? ValorIcms { get; set; }

    public decimal? AliquotaIcms { get; set; }

    public decimal? ValorIpi { get; set; }

    public decimal? AliquotaIpi { get; set; }

    public decimal? ValorPis { get; set; }

    public decimal? AliquotaPis { get; set; }

    public decimal? ValorCofins { get; set; }

    public decimal? AliquotaCofins { get; set; }

    public string? CstIcms { get; set; }

    public string? CstIpi { get; set; }

    public string? CstPis { get; set; }

    public string? CstCofins { get; set; }

    public string? Marca { get; set; }

    public string? Categoria { get; set; }

    public DateTime? DataValidade { get; set; }

    public string? Lote { get; set; }
}

public class PaymentInfoDto
{
    [Required]
    public string FormaPagamento { get; set; } = string.Empty;

    [Required]
    public decimal Valor { get; set; }

    public string? MeioPagamento { get; set; }

    public string? BandeiraCartao { get; set; }

    public string? NumeroAutorizacao { get; set; }

    public DateTime? DataVencimento { get; set; }
}