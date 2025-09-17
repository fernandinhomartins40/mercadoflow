using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MercadoFlow.Desktop.Models;
using MercadoFlow.Desktop.Models.DTOs;

namespace MercadoFlow.Desktop.Services;

public interface IApiService
{
    Task<ApiResponse<InvoiceProcessingResponse>> SendInvoiceAsync(InvoiceDto invoice, CancellationToken cancellationToken = default);
    Task<ApiResponse<BatchProcessingResponse>> SendBatchAsync(List<InvoiceDto> invoices, CancellationToken cancellationToken = default);
    Task<ApiResponse<HealthCheckResponse>> HealthCheckAsync(CancellationToken cancellationToken = default);
    Task<bool> TestConnectionAsync(CancellationToken cancellationToken = default);
    ConnectivityStatus GetConnectionStatus();
    ApiStatistics GetStatistics();
    event EventHandler<ConnectivityStatusEventArgs> ConnectivityChanged;
}

public class ConnectivityStatusEventArgs : EventArgs
{
    public ConnectivityStatus Status { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string? Message { get; set; }
    public Exception? Exception { get; set; }
}

public class ApiStatistics
{
    public int TotalRequests { get; set; }
    public int SuccessfulRequests { get; set; }
    public int FailedRequests { get; set; }
    public int TimeoutRequests { get; set; }
    public int RetryRequests { get; set; }
    public TimeSpan AverageResponseTime { get; set; }
    public DateTime? LastSuccessfulRequest { get; set; }
    public DateTime? LastFailedRequest { get; set; }
    public string? LastError { get; set; }
    public ConnectivityStatus CurrentStatus { get; set; }
    public Dictionary<int, int> ResponseCodeCounts { get; set; } = new();
    public double SuccessRate => TotalRequests > 0 ? (double)SuccessfulRequests / TotalRequests * 100 : 0;
}