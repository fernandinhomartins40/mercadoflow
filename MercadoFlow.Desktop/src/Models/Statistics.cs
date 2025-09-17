using System;

namespace MercadoFlow.Desktop.Models;

public class ProcessingStatistics
{
    public DateTime Date { get; set; } = DateTime.Today;

    public int FilesProcessed { get; set; }

    public int FilesSuccessful { get; set; }

    public int FilesError { get; set; }

    public int FilesDuplicate { get; set; }

    public int InvoicesProcessed { get; set; }

    public int ItemsProcessed { get; set; }

    public decimal TotalValue { get; set; }

    public TimeSpan TotalProcessingTime { get; set; }

    public TimeSpan AverageProcessingTime { get; set; }

    public int QueueSize { get; set; }

    public int RetryCount { get; set; }

    public int DeadLetterCount { get; set; }

    public double SuccessRate => FilesProcessed > 0 ? (double)FilesSuccessful / FilesProcessed * 100 : 0;

    public double ErrorRate => FilesProcessed > 0 ? (double)FilesError / FilesProcessed * 100 : 0;
}

public class SystemHealth
{
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    public ServiceStatus ServiceStatus { get; set; }

    public ConnectivityStatus ApiConnectivity { get; set; }

    public bool DatabaseHealth { get; set; }

    public int ActiveConnections { get; set; }

    public long MemoryUsage { get; set; }

    public double CpuUsage { get; set; }

    public long DiskSpace { get; set; }

    public DateTime? LastSuccessfulSync { get; set; }

    public DateTime? LastError { get; set; }

    public string? LastErrorMessage { get; set; }

    public TimeSpan Uptime { get; set; }

    public string Version { get; set; } = string.Empty;
}

public class Alert
{
    public string Id { get; set; } = Guid.NewGuid().ToString();

    public AlertType Type { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Message { get; set; } = string.Empty;

    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    public bool IsRead { get; set; }

    public bool IsAcknowledged { get; set; }

    public string? Source { get; set; }

    public string? Category { get; set; }

    public object? Data { get; set; }
}