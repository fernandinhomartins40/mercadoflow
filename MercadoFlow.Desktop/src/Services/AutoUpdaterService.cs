using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MercadoFlow.Desktop.Configuration;

namespace MercadoFlow.Desktop.Services;

public class AutoUpdaterService : IAutoUpdaterService
{
    private readonly ILogger<AutoUpdaterService> _logger;
    private readonly HttpClient _httpClient;
    private readonly AppSettings _appSettings;

    public event EventHandler<UpdateAvailableEventArgs>? UpdateAvailable;

    public AutoUpdaterService(
        ILogger<AutoUpdaterService> logger,
        HttpClient httpClient,
        IOptions<AppSettings> appSettings)
    {
        _logger = logger;
        _httpClient = httpClient;
        _appSettings = appSettings.Value;
    }

    public async Task<UpdateInfo?> CheckForUpdatesAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var updateUrl = "https://api.mercadoflow.com/updates/check";
            var currentVersion = await GetCurrentVersionAsync();

            var requestData = new
            {
                currentVersion,
                platform = "windows",
                application = "desktop"
            };

            var json = JsonSerializer.Serialize(requestData);
            var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync(updateUrl, content, cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);
                var updateInfo = JsonSerializer.Deserialize<UpdateInfo>(responseJson, new JsonSerializerOptions
                {
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                });

                if (updateInfo != null && IsUpdateRequired(currentVersion, updateInfo.Version))
                {
                    _logger.LogInformation("Atualização disponível: {Version}", updateInfo.Version);

                    UpdateAvailable?.Invoke(this, new UpdateAvailableEventArgs
                    {
                        UpdateInfo = updateInfo,
                        CurrentVersion = currentVersion,
                        DetectedAt = DateTime.UtcNow
                    });

                    return updateInfo;
                }
            }

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao verificar atualizações");
            return null;
        }
    }

    public async Task<bool> DownloadUpdateAsync(UpdateInfo updateInfo, IProgress<int>? progress = null, CancellationToken cancellationToken = default)
    {
        try
        {
            var tempPath = Path.Combine(Path.GetTempPath(), "MercadoFlowUpdate.msi");

            using var response = await _httpClient.GetAsync(updateInfo.DownloadUrl, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            response.EnsureSuccessStatusCode();

            var totalBytes = response.Content.Headers.ContentLength ?? 0;
            var downloadedBytes = 0L;

            using var contentStream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var fileStream = new FileStream(tempPath, FileMode.Create, FileAccess.Write, FileShare.None);

            var buffer = new byte[8192];
            int bytesRead;

            while ((bytesRead = await contentStream.ReadAsync(buffer, 0, buffer.Length, cancellationToken)) > 0)
            {
                await fileStream.WriteAsync(buffer, 0, bytesRead, cancellationToken);
                downloadedBytes += bytesRead;

                if (totalBytes > 0)
                {
                    var progressPercentage = (int)((downloadedBytes * 100) / totalBytes);
                    progress?.Report(progressPercentage);
                }
            }

            _logger.LogInformation("Atualização baixada: {FilePath}", tempPath);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao baixar atualização");
            return false;
        }
    }

    public async Task InstallUpdateAsync(string updateFilePath)
    {
        try
        {
            if (!File.Exists(updateFilePath))
            {
                throw new FileNotFoundException("Arquivo de atualização não encontrado", updateFilePath);
            }

            var startInfo = new ProcessStartInfo
            {
                FileName = "msiexec.exe",
                Arguments = $"/i \"{updateFilePath}\" /quiet /norestart",
                UseShellExecute = true,
                Verb = "runas" // Executar como administrador
            };

            _logger.LogInformation("Iniciando instalação da atualização: {UpdateFile}", updateFilePath);

            var process = Process.Start(startInfo);
            if (process != null)
            {
                await process.WaitForExitAsync();
                _logger.LogInformation("Instalação da atualização concluída. Código de saída: {ExitCode}", process.ExitCode);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao instalar atualização");
            throw;
        }
    }

    public async Task<string> GetCurrentVersionAsync()
    {
        try
        {
            var assembly = typeof(AutoUpdaterService).Assembly;
            var version = assembly.GetName().Version;
            return version?.ToString() ?? "1.0.0";
        }
        catch
        {
            return "1.0.0";
        }
    }

    public bool IsUpdateRequired(string currentVersion, string latestVersion)
    {
        try
        {
            var current = new Version(currentVersion);
            var latest = new Version(latestVersion);

            return latest > current;
        }
        catch
        {
            return false;
        }
    }
}