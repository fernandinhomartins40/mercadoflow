using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MercadoFlow.Desktop.Models;

public class InvoiceItem
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    public string InvoiceId { get; set; } = string.Empty;

    [ForeignKey(nameof(InvoiceId))]
    public virtual InvoiceData Invoice { get; set; } = null!;

    public string? ProductId { get; set; }

    [Required]
    public int NumeroItem { get; set; }

    public string? CodigoEAN { get; set; }

    [Required]
    public string CodigoInterno { get; set; } = string.Empty;

    [Required]
    public string Descricao { get; set; } = string.Empty;

    [Required]
    [StringLength(8)]
    public string Ncm { get; set; } = string.Empty;

    [Required]
    [StringLength(4)]
    public string Cfop { get; set; } = string.Empty;

    [Required]
    public string UnidadeComercial { get; set; } = string.Empty;

    [Required]
    [Column(TypeName = "decimal(18,4)")]
    public decimal Quantidade { get; set; }

    [Required]
    [Column(TypeName = "decimal(18,4)")]
    public decimal ValorUnitario { get; set; }

    [Required]
    [Column(TypeName = "decimal(18,2)")]
    public decimal ValorTotal { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal? ValorDesconto { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal? ValorFrete { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal? ValorSeguro { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal? OutrasDespesas { get; set; }

    public string? OrigemMercadoria { get; set; }

    // ICMS
    [Column(TypeName = "decimal(18,2)")]
    public decimal? BaseCalculoIcms { get; set; }

    [Column(TypeName = "decimal(5,2)")]
    public decimal? AliquotaIcms { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal? ValorIcms { get; set; }

    public string? CstIcms { get; set; }

    // ICMS ST
    [Column(TypeName = "decimal(18,2)")]
    public decimal? BaseCalculoIcmsSt { get; set; }

    [Column(TypeName = "decimal(5,2)")]
    public decimal? AliquotaIcmsSt { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal? ValorIcmsSt { get; set; }

    // IPI
    [Column(TypeName = "decimal(18,2)")]
    public decimal? BaseCalculoIpi { get; set; }

    [Column(TypeName = "decimal(5,2)")]
    public decimal? AliquotaIpi { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal? ValorIpi { get; set; }

    public string? CstIpi { get; set; }

    // PIS
    [Column(TypeName = "decimal(18,2)")]
    public decimal? BaseCalculoPis { get; set; }

    [Column(TypeName = "decimal(5,2)")]
    public decimal? AliquotaPis { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal? ValorPis { get; set; }

    public string? CstPis { get; set; }

    // COFINS
    [Column(TypeName = "decimal(18,2)")]
    public decimal? BaseCalculoCofins { get; set; }

    [Column(TypeName = "decimal(5,2)")]
    public decimal? AliquotaCofins { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal? ValorCofins { get; set; }

    public string? CstCofins { get; set; }

    // Informações adicionais
    public string? InformacoesAdicionais { get; set; }

    public string? Marca { get; set; }

    public string? Modelo { get; set; }

    public string? Categoria { get; set; }

    public DateTime? DataValidade { get; set; }

    public string? Lote { get; set; }

    [Column(TypeName = "decimal(18,3)")]
    public decimal? PesoBruto { get; set; }

    [Column(TypeName = "decimal(18,3)")]
    public decimal? PesoLiquido { get; set; }
}