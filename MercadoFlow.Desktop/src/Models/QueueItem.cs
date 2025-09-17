using System;
using System.ComponentModel.DataAnnotations;

namespace MercadoFlow.Desktop.Models;

public enum QueueStatus
{
    Pending = 0,
    Processing = 1,
    Sent = 2,
    Error = 3,
    DeadLetter = 4,
    Retry = 5
}

public class QueueItem
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    [StringLength(44)]
    public string ChaveNFe { get; set; } = string.Empty;

    [Required]
    public string PayloadJson { get; set; } = string.Empty;

    [Required]
    public QueueStatus Status { get; set; } = QueueStatus.Pending;

    public int Tentativas { get; set; } = 0;

    [Required]
    public DateTime DataCriacao { get; set; } = DateTime.UtcNow;

    public DateTime? DataProcessamento { get; set; }

    public DateTime? DataEnvio { get; set; }

    public DateTime? ProximaTentativa { get; set; }

    public string? ErroDetalhes { get; set; }

    public string? ResponseBody { get; set; }

    public int? HttpStatusCode { get; set; }

    public string? ArquivoOrigem { get; set; }

    public long? TamanhoArquivo { get; set; }

    public string? HashArquivo { get; set; }

    public string? Endpoint { get; set; }

    public TimeSpan? TempoProcessamento { get; set; }

    public int Prioridade { get; set; } = 0;

    public string? Tags { get; set; }

    public string? Metadata { get; set; }
}