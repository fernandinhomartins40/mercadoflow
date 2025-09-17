using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MercadoFlow.Desktop.Models;

namespace MercadoFlow.Desktop.Services;

public interface IHealthCheckService
{
    Task<SystemHealth> GetSystemHealthAsync(CancellationToken cancellationToken = default);
    Task<bool> IsHealthyAsync(CancellationToken cancellationToken = default);
    Task<Dictionary<string, object>> GetDiagnosticsAsync(CancellationToken cancellationToken = default);
    event EventHandler<HealthStatusChangedEventArgs> HealthStatusChanged;
}

public class HealthStatusChangedEventArgs : EventArgs
{
    public required SystemHealth CurrentHealth { get; init; }
    public required SystemHealth? PreviousHealth { get; init; }
    public required DateTime Timestamp { get; init; }
}