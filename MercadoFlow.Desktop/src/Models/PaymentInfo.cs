using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MercadoFlow.Desktop.Models;

public class PaymentInfo
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    public string InvoiceId { get; set; } = string.Empty;

    [ForeignKey(nameof(InvoiceId))]
    public virtual InvoiceData Invoice { get; set; } = null!;

    [Required]
    public string FormaPagamento { get; set; } = string.Empty;

    [Required]
    [Column(TypeName = "decimal(18,2)")]
    public decimal Valor { get; set; }

    public string? MeioPagamento { get; set; }

    public string? TipoIntegracao { get; set; }

    public string? CNPJCredenciadora { get; set; }

    public string? BandeiraCartao { get; set; }

    public string? NumeroAutorizacao { get; set; }

    public DateTime? DataVencimento { get; set; }

    public string? InformacoesAdicionais { get; set; }
}