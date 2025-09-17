using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MercadoFlow.Desktop.Models;

namespace MercadoFlow.Desktop.Services;

public interface IFileMonitoringService
{
    event EventHandler<FileDetectedEventArgs> FileDetected;
    event EventHandler<FileProcessingEventArgs> FileProcessingUpdate;
    event EventHandler<MonitoringStatusEventArgs> StatusChanged;

    Task StartMonitoringAsync(CancellationToken cancellationToken = default);
    Task StopMonitoringAsync();
    Task AddWatchFolderAsync(string folderPath);
    Task RemoveWatchFolderAsync(string folderPath);
    Task RefreshWatchFoldersAsync();

    bool IsMonitoring { get; }
    IReadOnlyList<string> WatchedFolders { get; }
    MonitoringStatistics GetStatistics();
}

public class FileDetectedEventArgs : EventArgs
{
    public required string FilePath { get; init; }
    public required string FileName { get; init; }
    public required long FileSizeBytes { get; init; }
    public required DateTime DetectedAt { get; init; }
    public required string WatchedFolder { get; init; }
    public bool IsZipFile { get; init; }
    public string? FileHash { get; init; }
}

public class FileProcessingEventArgs : EventArgs
{
    public required string FilePath { get; init; }
    public required FileStatus Status { get; init; }
    public required DateTime Timestamp { get; init; }
    public string? ErrorMessage { get; init; }
    public object? AdditionalData { get; init; }
}

public class MonitoringStatusEventArgs : EventArgs
{
    public required ServiceStatus Status { get; init; }
    public required DateTime Timestamp { get; init; }
    public string? Message { get; init; }
    public Exception? Exception { get; init; }
}

public class MonitoringStatistics
{
    public DateTime StartTime { get; set; }
    public TimeSpan TotalUptime { get; set; }
    public int TotalFilesDetected { get; set; }
    public int FilesProcessedToday { get; set; }
    public int FilesErrorToday { get; set; }
    public int ActiveWatchers { get; set; }
    public Dictionary<string, int> FilesByFolder { get; set; } = new();
    public Dictionary<string, int> FilesByExtension { get; set; } = new();
    public DateTime? LastFileDetected { get; set; }
    public DateTime? LastError { get; set; }
    public string? LastErrorMessage { get; set; }
}