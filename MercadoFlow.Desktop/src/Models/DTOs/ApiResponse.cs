using System;
using System.Collections.Generic;

namespace MercadoFlow.Desktop.Models.DTOs;

public class ApiResponse<T>
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public T? Data { get; set; }
    public List<string> Errors { get; set; } = new();
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string? RequestId { get; set; }
    public string? Version { get; set; }
}

public class ApiResponse : ApiResponse<object>
{
}

public class InvoiceProcessingResponse
{
    public string ChaveNFe { get; set; } = string.Empty;
    public bool Processed { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? Message { get; set; }
    public DateTime ProcessedAt { get; set; }
    public string? InvoiceId { get; set; }
    public int ItemCount { get; set; }
    public List<ValidationError> ValidationErrors { get; set; } = new();
}

public class ValidationError
{
    public string Field { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? Code { get; set; }
    public object? AttemptedValue { get; set; }
}

public class BatchProcessingResponse
{
    public int TotalInvoices { get; set; }
    public int ProcessedCount { get; set; }
    public int ErrorCount { get; set; }
    public List<InvoiceProcessingResponse> Results { get; set; } = new();
    public DateTime ProcessedAt { get; set; } = DateTime.UtcNow;
    public TimeSpan ProcessingTime { get; set; }
}

public class HealthCheckResponse
{
    public string Status { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string Version { get; set; } = string.Empty;
    public Dictionary<string, object> Components { get; set; } = new();
    public TimeSpan Uptime { get; set; }
}