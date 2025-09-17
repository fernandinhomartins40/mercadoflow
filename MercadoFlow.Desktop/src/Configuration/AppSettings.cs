using System;
using System.Collections.Generic;

namespace MercadoFlow.Desktop.Configuration;

public class AppSettings
{
    public string ApplicationName { get; set; } = "MercadoFlow Desktop Collector";
    public string Version { get; set; } = "1.0.0";
    public bool AutoStart { get; set; } = false;
    public bool AutoUpdate { get; set; } = true;
    public TimeSpan UpdateCheckInterval { get; set; } = TimeSpan.FromHours(24);
}

public class ApiSettings
{
    public string BaseUrl { get; set; } = "https://api.mercadoflow.com";
    public string IngestEndpoint { get; set; } = "/api/v1/ingest/invoice";
    public string BatchEndpoint { get; set; } = "/api/v1/ingest/batch";
    public string HealthCheckEndpoint { get; set; } = "/api/v1/health";
    public TimeSpan Timeout { get; set; } = TimeSpan.FromMinutes(5);
    public int RetryAttempts { get; set; } = 5;
    public List<TimeSpan> RetryDelays { get; set; } = new()
    {
        TimeSpan.FromSeconds(1),
        TimeSpan.FromSeconds(2),
        TimeSpan.FromSeconds(4),
        TimeSpan.FromSeconds(8),
        TimeSpan.FromSeconds(16)
    };
    public bool EnableCompression { get; set; } = true;
    public string UserAgent { get; set; } = "MercadoFlow-Desktop/1.0.0";
    public string? ApiKey { get; set; }
    public string? MarketId { get; set; }
    public Dictionary<string, string> Headers { get; set; } = new();
}

public class MonitoringSettings
{
    public List<string> WatchedFolders { get; set; } = new();
    public List<string> FilePatterns { get; set; } = new() { "*.xml", "*.zip" };
    public List<string> ExcludePatterns { get; set; } = new() { "*.tmp", "*.temp", "*~*" };
    public int DebounceDelayMs { get; set; } = 2000;
    public int MaxFileSizeMB { get; set; } = 50;
    public bool ProcessSubfolders { get; set; } = true;
    public bool DeleteAfterProcessing { get; set; } = false;
    public bool MoveToProcessedFolder { get; set; } = true;
    public string? ProcessedFolderPath { get; set; }
}

public class DatabaseSettings
{
    public string ConnectionString { get; set; } = "Data Source=Data/mercadoflow.db;Cache=Shared";
    public int CommandTimeout { get; set; } = 30;
    public bool EnableSensitiveDataLogging { get; set; } = false;
    public int MaxRetryAttempts { get; set; } = 3;
    public int RetryDelayMs { get; set; } = 1000;
}

public class SecuritySettings
{
    public bool ValidateCertificates { get; set; } = true;
    public bool RequireHttps { get; set; } = true;
    public bool EncryptLocalData { get; set; } = true;
    public bool ValidateXmlSignature { get; set; } = true;
    public bool ValidateXmlSchema { get; set; } = true;
    public string? EncryptionKey { get; set; }
}

public class LoggingSettings
{
    public string LogLevel { get; set; } = "Information";
    public int MaxLogFileSizeMB { get; set; } = 10;
    public int MaxLogFiles { get; set; } = 7;
    public bool LogToFile { get; set; } = true;
    public bool LogToConsole { get; set; } = false;
    public bool StructuredLogging { get; set; } = true;
}

public class PerformanceSettings
{
    public int MaxConcurrentProcessing { get; set; } = 5;
    public int BatchSize { get; set; } = 100;
    public int MaxQueueSize { get; set; } = 10000;
    public int ProcessingTimeoutMs { get; set; } = 30000;
    public int HealthCheckIntervalMs { get; set; } = 60000;
}