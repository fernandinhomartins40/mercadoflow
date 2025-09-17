using System;
using System.Threading;
using System.Threading.Tasks;

namespace MercadoFlow.Desktop.Services;

public interface IAutoUpdaterService
{
    Task<UpdateInfo?> CheckForUpdatesAsync(CancellationToken cancellationToken = default);
    Task<bool> DownloadUpdateAsync(UpdateInfo updateInfo, IProgress<int>? progress = null, CancellationToken cancellationToken = default);
    Task InstallUpdateAsync(string updateFilePath);
    Task<string> GetCurrentVersionAsync();
    bool IsUpdateRequired(string currentVersion, string latestVersion);
    event EventHandler<UpdateAvailableEventArgs> UpdateAvailable;
}

public class UpdateInfo
{
    public required string Version { get; init; }
    public required string DownloadUrl { get; init; }
    public required DateTime ReleaseDate { get; init; }
    public string? ReleaseNotes { get; init; }
    public long FileSize { get; init; }
    public string? Checksum { get; init; }
    public bool IsRequired { get; init; }
}

public class UpdateAvailableEventArgs : EventArgs
{
    public required UpdateInfo UpdateInfo { get; init; }
    public required string CurrentVersion { get; init; }
    public required DateTime DetectedAt { get; init; }
}