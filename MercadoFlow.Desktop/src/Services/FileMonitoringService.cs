using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MercadoFlow.Desktop.Configuration;
using MercadoFlow.Desktop.Models;

namespace MercadoFlow.Desktop.Services;

public class FileMonitoringService : IFileMonitoringService, IDisposable
{
    private readonly ILogger<FileMonitoringService> _logger;
    private readonly MonitoringSettings _settings;
    private readonly PerformanceSettings _performanceSettings;

    private readonly List<FileSystemWatcher> _watchers = new();
    private readonly ConcurrentDictionary<string, FileWatchInfo> _pendingFiles = new();
    private readonly ConcurrentDictionary<string, string> _processedFiles = new();
    private readonly Timer _debounceTimer;
    private readonly object _lockObject = new();
    private readonly MonitoringStatistics _statistics = new();

    private CancellationTokenSource? _cancellationTokenSource;
    private bool _isMonitoring;
    private bool _disposed;

    public event EventHandler<FileDetectedEventArgs>? FileDetected;
    public event EventHandler<FileProcessingEventArgs>? FileProcessingUpdate;
    public event EventHandler<MonitoringStatusEventArgs>? StatusChanged;

    public bool IsMonitoring => _isMonitoring;
    public IReadOnlyList<string> WatchedFolders => _settings.WatchedFolders.AsReadOnly();

    public FileMonitoringService(
        ILogger<FileMonitoringService> logger,
        IOptions<MonitoringSettings> settings,
        IOptions<PerformanceSettings> performanceSettings)
    {
        _logger = logger;
        _settings = settings.Value;
        _performanceSettings = performanceSettings.Value;

        _debounceTimer = new Timer(ProcessPendingFiles, null, Timeout.Infinite, Timeout.Infinite);
        _statistics.StartTime = DateTime.UtcNow;
    }

    public async Task StartMonitoringAsync(CancellationToken cancellationToken = default)
    {
        if (_isMonitoring)
        {
            _logger.LogWarning("Monitoramento já está ativo");
            return;
        }

        _logger.LogInformation("Iniciando monitoramento de arquivos...");

        try
        {
            _cancellationTokenSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);

            await ValidateAndCreateWatchersAsync();
            StartDebounceTimer();

            _isMonitoring = true;
            _statistics.StartTime = DateTime.UtcNow;

            OnStatusChanged(ServiceStatus.Running, "Monitoramento iniciado com sucesso");
            _logger.LogInformation("Monitoramento iniciado para {FolderCount} pastas", _watchers.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao iniciar monitoramento");
            await StopMonitoringAsync();
            OnStatusChanged(ServiceStatus.Error, "Erro ao iniciar monitoramento", ex);
            throw;
        }
    }

    public async Task StopMonitoringAsync()
    {
        if (!_isMonitoring)
        {
            return;
        }

        _logger.LogInformation("Parando monitoramento de arquivos...");

        OnStatusChanged(ServiceStatus.Stopping, "Parando monitoramento");

        try
        {
            _isMonitoring = false;

            // Parar timer de debounce
            _debounceTimer.Change(Timeout.Infinite, Timeout.Infinite);

            // Parar todos os watchers
            lock (_lockObject)
            {
                foreach (var watcher in _watchers)
                {
                    try
                    {
                        watcher.EnableRaisingEvents = false;
                        watcher.Dispose();
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Erro ao parar watcher para {Path}", watcher.Path);
                    }
                }
                _watchers.Clear();
            }

            // Cancelar operações pendentes
            _cancellationTokenSource?.Cancel();

            // Processar arquivos pendentes finais
            await ProcessRemainingPendingFiles();

            OnStatusChanged(ServiceStatus.Stopped, "Monitoramento parado");
            _logger.LogInformation("Monitoramento de arquivos parado");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao parar monitoramento");
            OnStatusChanged(ServiceStatus.Error, "Erro ao parar monitoramento", ex);
        }
    }

    public async Task AddWatchFolderAsync(string folderPath)
    {
        if (string.IsNullOrWhiteSpace(folderPath))
        {
            throw new ArgumentException("Caminho da pasta não pode ser vazio", nameof(folderPath));
        }

        if (!Directory.Exists(folderPath))
        {
            throw new DirectoryNotFoundException($"Pasta não encontrada: {folderPath}");
        }

        if (_settings.WatchedFolders.Contains(folderPath, StringComparer.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Pasta já está sendo monitorada: {FolderPath}", folderPath);
            return;
        }

        _settings.WatchedFolders.Add(folderPath);

        if (_isMonitoring)
        {
            await CreateWatcherForFolderAsync(folderPath);
            _logger.LogInformation("Pasta adicionada ao monitoramento: {FolderPath}", folderPath);
        }
    }

    public async Task RemoveWatchFolderAsync(string folderPath)
    {
        if (!_settings.WatchedFolders.Remove(folderPath))
        {
            _logger.LogWarning("Pasta não estava sendo monitorada: {FolderPath}", folderPath);
            return;
        }

        if (_isMonitoring)
        {
            lock (_lockObject)
            {
                var watcherToRemove = _watchers.FirstOrDefault(w =>
                    string.Equals(w.Path, folderPath, StringComparison.OrdinalIgnoreCase));

                if (watcherToRemove != null)
                {
                    watcherToRemove.EnableRaisingEvents = false;
                    watcherToRemove.Dispose();
                    _watchers.Remove(watcherToRemove);
                }
            }

            _logger.LogInformation("Pasta removida do monitoramento: {FolderPath}", folderPath);
        }
    }

    public async Task RefreshWatchFoldersAsync()
    {
        if (!_isMonitoring)
        {
            return;
        }

        _logger.LogInformation("Atualizando monitoramento de pastas...");

        await StopMonitoringAsync();
        await StartMonitoringAsync();
    }

    public MonitoringStatistics GetStatistics()
    {
        _statistics.TotalUptime = DateTime.UtcNow - _statistics.StartTime;
        _statistics.ActiveWatchers = _watchers.Count;
        return _statistics;
    }

    private async Task ValidateAndCreateWatchersAsync()
    {
        if (!_settings.WatchedFolders.Any())
        {
            throw new InvalidOperationException("Nenhuma pasta configurada para monitoramento");
        }

        var validFolders = new List<string>();

        foreach (var folder in _settings.WatchedFolders)
        {
            if (Directory.Exists(folder))
            {
                validFolders.Add(folder);
            }
            else
            {
                _logger.LogWarning("Pasta não encontrada e será ignorada: {FolderPath}", folder);
            }
        }

        if (!validFolders.Any())
        {
            throw new InvalidOperationException("Nenhuma pasta válida encontrada para monitoramento");
        }

        foreach (var folder in validFolders)
        {
            await CreateWatcherForFolderAsync(folder);
        }
    }

    private async Task CreateWatcherForFolderAsync(string folderPath)
    {
        try
        {
            var watcher = new FileSystemWatcher(folderPath)
            {
                NotifyFilter = NotifyFilters.FileName | NotifyFilters.Size | NotifyFilters.LastWrite,
                IncludeSubdirectories = _settings.ProcessSubfolders,
                EnableRaisingEvents = false
            };

            // Configurar filtros de arquivo
            foreach (var pattern in _settings.FilePatterns)
            {
                watcher.Filter = pattern;
            }

            // Eventos
            watcher.Created += OnFileCreated;
            watcher.Changed += OnFileChanged;
            watcher.Renamed += OnFileRenamed;
            watcher.Error += OnWatcherError;

            lock (_lockObject)
            {
                _watchers.Add(watcher);
            }

            watcher.EnableRaisingEvents = true;

            _logger.LogDebug("Watcher criado para pasta: {FolderPath}", folderPath);

            // Processar arquivos existentes na pasta
            await ProcessExistingFilesAsync(folderPath);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao criar watcher para pasta: {FolderPath}", folderPath);
            throw;
        }
    }

    private async Task ProcessExistingFilesAsync(string folderPath)
    {
        try
        {
            var searchOption = _settings.ProcessSubfolders
                ? SearchOption.AllDirectories
                : SearchOption.TopDirectoryOnly;

            var files = new List<string>();

            foreach (var pattern in _settings.FilePatterns)
            {
                try
                {
                    var patternFiles = Directory.GetFiles(folderPath, pattern, searchOption);
                    files.AddRange(patternFiles);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Erro ao buscar arquivos com padrão {Pattern} em {FolderPath}",
                        pattern, folderPath);
                }
            }

            foreach (var file in files.Distinct())
            {
                if (ShouldProcessFile(file))
                {
                    await QueueFileForProcessingAsync(file, "Arquivo existente detectado");
                }
            }

            _logger.LogDebug("Processados {FileCount} arquivos existentes em {FolderPath}",
                files.Count, folderPath);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar arquivos existentes em: {FolderPath}", folderPath);
        }
    }

    private void OnFileCreated(object sender, FileSystemEventArgs e)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                await QueueFileForProcessingAsync(e.FullPath, "Arquivo criado");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao processar arquivo criado: {FilePath}", e.FullPath);
            }
        });
    }

    private void OnFileChanged(object sender, FileSystemEventArgs e)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                await QueueFileForProcessingAsync(e.FullPath, "Arquivo modificado");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao processar arquivo modificado: {FilePath}", e.FullPath);
            }
        });
    }

    private void OnFileRenamed(object sender, RenamedEventArgs e)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                await QueueFileForProcessingAsync(e.FullPath, "Arquivo renomeado");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao processar arquivo renomeado: {FilePath}", e.FullPath);
            }
        });
    }

    private void OnWatcherError(object sender, ErrorEventArgs e)
    {
        _logger.LogError(e.GetException(), "Erro no FileSystemWatcher");

        var watcher = sender as FileSystemWatcher;
        var path = watcher?.Path ?? "Desconhecido";

        OnStatusChanged(ServiceStatus.Error, $"Erro no monitoramento da pasta: {path}", e.GetException());

        // Tentar recriar o watcher
        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(5000); // Aguardar antes de tentar recriar
                if (_isMonitoring && watcher != null)
                {
                    await RecreateWatcherAsync(watcher);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao recriar watcher para: {Path}", path);
            }
        });
    }

    private async Task RecreateWatcherAsync(FileSystemWatcher failedWatcher)
    {
        var path = failedWatcher.Path;

        _logger.LogInformation("Recriando watcher para: {Path}", path);

        lock (_lockObject)
        {
            _watchers.Remove(failedWatcher);
        }

        try
        {
            failedWatcher.Dispose();
        }
        catch { }

        await CreateWatcherForFolderAsync(path);
        _logger.LogInformation("Watcher recriado para: {Path}", path);
    }

    private async Task QueueFileForProcessingAsync(string filePath, string reason)
    {
        if (!ShouldProcessFile(filePath))
        {
            return;
        }

        var fileName = Path.GetFileName(filePath);
        var watchInfo = new FileWatchInfo
        {
            FilePath = filePath,
            FileName = fileName,
            DetectedAt = DateTime.UtcNow,
            Reason = reason,
            LastUpdate = DateTime.UtcNow
        };

        _pendingFiles.AddOrUpdate(filePath, watchInfo, (key, existing) =>
        {
            existing.LastUpdate = DateTime.UtcNow;
            existing.UpdateCount++;
            return existing;
        });

        _statistics.TotalFilesDetected++;
        _statistics.LastFileDetected = DateTime.UtcNow;

        OnFileProcessingUpdate(filePath, FileStatus.Detected, reason);

        _logger.LogDebug("Arquivo adicionado à fila: {FilePath} ({Reason})", filePath, reason);
    }

    private bool ShouldProcessFile(string filePath)
    {
        try
        {
            // Verificar se arquivo existe
            if (!File.Exists(filePath))
                return false;

            var fileName = Path.GetFileName(filePath);

            // Verificar padrões de exclusão
            foreach (var excludePattern in _settings.ExcludePatterns)
            {
                if (IsMatch(fileName, excludePattern))
                {
                    _logger.LogDebug("Arquivo ignorado por padrão de exclusão {Pattern}: {FileName}",
                        excludePattern, fileName);
                    return false;
                }
            }

            // Verificar se já foi processado
            var fileHash = GetFileHash(filePath);
            if (_processedFiles.ContainsKey(fileHash))
            {
                _logger.LogDebug("Arquivo já processado (hash duplicado): {FilePath}", filePath);
                return false;
            }

            // Verificar tamanho do arquivo
            var fileInfo = new FileInfo(filePath);
            if (fileInfo.Length > _settings.MaxFileSizeMB * 1024 * 1024)
            {
                _logger.LogWarning("Arquivo muito grande ignorado: {FilePath} ({Size} MB)",
                    filePath, fileInfo.Length / 1024 / 1024);
                return false;
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao verificar se arquivo deve ser processado: {FilePath}", filePath);
            return false;
        }
    }

    private void ProcessPendingFiles(object? state)
    {
        if (!_isMonitoring || _cancellationTokenSource?.Token.IsCancellationRequested == true)
            return;

        try
        {
            var cutoffTime = DateTime.UtcNow.AddMilliseconds(-_settings.DebounceDelayMs);
            var filesToProcess = _pendingFiles.Values
                .Where(f => f.LastUpdate <= cutoffTime && !f.IsBeingProcessed)
                .Take(_performanceSettings.BatchSize)
                .ToList();

            if (!filesToProcess.Any())
                return;

            _logger.LogDebug("Processando {FileCount} arquivos pendentes", filesToProcess.Count);

            Parallel.ForEach(filesToProcess, new ParallelOptions
            {
                MaxDegreeOfParallelism = _performanceSettings.MaxConcurrentProcessing,
                CancellationToken = _cancellationTokenSource?.Token ?? CancellationToken.None
            }, async fileInfo =>
            {
                await ProcessSingleFileAsync(fileInfo);
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar arquivos pendentes");
        }
    }

    private async Task ProcessSingleFileAsync(FileWatchInfo fileInfo)
    {
        try
        {
            fileInfo.IsBeingProcessed = true;

            if (!File.Exists(fileInfo.FilePath))
            {
                _pendingFiles.TryRemove(fileInfo.FilePath, out _);
                return;
            }

            // Verificar se arquivo ainda está sendo escrito
            if (!IsFileReady(fileInfo.FilePath))
            {
                _logger.LogDebug("Arquivo ainda sendo escrito, aguardando: {FilePath}", fileInfo.FilePath);
                fileInfo.IsBeingProcessed = false;
                fileInfo.LastUpdate = DateTime.UtcNow;
                return;
            }

            OnFileProcessingUpdate(fileInfo.FilePath, FileStatus.Reading, "Lendo arquivo");

            var fileInfo2 = new FileInfo(fileInfo.FilePath);
            var watchedFolder = GetWatchedFolderForFile(fileInfo.FilePath);

            var eventArgs = new FileDetectedEventArgs
            {
                FilePath = fileInfo.FilePath,
                FileName = fileInfo.FileName,
                FileSizeBytes = fileInfo2.Length,
                DetectedAt = fileInfo.DetectedAt,
                WatchedFolder = watchedFolder,
                IsZipFile = Path.GetExtension(fileInfo.FilePath).ToLowerInvariant() == ".zip",
                FileHash = GetFileHash(fileInfo.FilePath)
            };

            // Marcar como processado
            if (eventArgs.FileHash != null)
            {
                _processedFiles.TryAdd(eventArgs.FileHash, fileInfo.FilePath);
            }

            // Remover da fila
            _pendingFiles.TryRemove(fileInfo.FilePath, out _);

            // Notificar sobre o arquivo detectado
            FileDetected?.Invoke(this, eventArgs);

            _statistics.FilesProcessedToday++;
            _statistics.FilesByFolder.TryGetValue(watchedFolder, out var count);
            _statistics.FilesByFolder[watchedFolder] = count + 1;

            var extension = Path.GetExtension(fileInfo.FileName).ToLowerInvariant();
            _statistics.FilesByExtension.TryGetValue(extension, out var extCount);
            _statistics.FilesByExtension[extension] = extCount + 1;

            OnFileProcessingUpdate(fileInfo.FilePath, FileStatus.Queued, "Arquivo adicionado à fila de processamento");

            _logger.LogInformation("Arquivo processado: {FilePath}", fileInfo.FilePath);
        }
        catch (Exception ex)
        {
            _statistics.FilesErrorToday++;
            _statistics.LastError = DateTime.UtcNow;
            _statistics.LastErrorMessage = ex.Message;

            OnFileProcessingUpdate(fileInfo.FilePath, FileStatus.Error, ex.Message);

            _logger.LogError(ex, "Erro ao processar arquivo: {FilePath}", fileInfo.FilePath);

            // Remover da fila mesmo com erro
            _pendingFiles.TryRemove(fileInfo.FilePath, out _);
        }
    }

    private bool IsFileReady(string filePath)
    {
        try
        {
            using var stream = File.Open(filePath, FileMode.Open, FileAccess.Read, FileShare.Read);
            return true;
        }
        catch (IOException)
        {
            return false;
        }
        catch
        {
            return true; // Outros erros, considerar como pronto
        }
    }

    private string GetFileHash(string filePath)
    {
        try
        {
            using var stream = File.OpenRead(filePath);
            using var sha256 = SHA256.Create();
            var hashBytes = sha256.ComputeHash(stream);
            return Convert.ToHexString(hashBytes);
        }
        catch
        {
            return $"{filePath}:{new FileInfo(filePath).Length}";
        }
    }

    private string GetWatchedFolderForFile(string filePath)
    {
        return _settings.WatchedFolders
            .FirstOrDefault(folder => filePath.StartsWith(folder, StringComparison.OrdinalIgnoreCase))
            ?? "Desconhecido";
    }

    private static bool IsMatch(string fileName, string pattern)
    {
        var regexPattern = "^" + Regex.Escape(pattern).Replace("\\*", ".*").Replace("\\?", ".") + "$";
        return Regex.IsMatch(fileName, regexPattern, RegexOptions.IgnoreCase);
    }

    private void StartDebounceTimer()
    {
        _debounceTimer.Change(TimeSpan.FromSeconds(1), TimeSpan.FromSeconds(1));
    }

    private async Task ProcessRemainingPendingFiles()
    {
        if (!_pendingFiles.Any())
            return;

        _logger.LogInformation("Processando {PendingCount} arquivos pendentes restantes", _pendingFiles.Count);

        var remainingFiles = _pendingFiles.Values.ToList();
        foreach (var fileInfo in remainingFiles)
        {
            try
            {
                await ProcessSingleFileAsync(fileInfo);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao processar arquivo pendente final: {FilePath}", fileInfo.FilePath);
            }
        }
    }

    private void OnStatusChanged(ServiceStatus status, string message, Exception? exception = null)
    {
        StatusChanged?.Invoke(this, new MonitoringStatusEventArgs
        {
            Status = status,
            Timestamp = DateTime.UtcNow,
            Message = message,
            Exception = exception
        });
    }

    private void OnFileProcessingUpdate(string filePath, FileStatus status, string? message = null)
    {
        FileProcessingUpdate?.Invoke(this, new FileProcessingEventArgs
        {
            FilePath = filePath,
            Status = status,
            Timestamp = DateTime.UtcNow,
            ErrorMessage = message
        });
    }

    public void Dispose()
    {
        if (_disposed)
            return;

        _disposed = true;

        try
        {
            StopMonitoringAsync().GetAwaiter().GetResult();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao parar monitoramento durante dispose");
        }

        _debounceTimer?.Dispose();
        _cancellationTokenSource?.Dispose();

        lock (_lockObject)
        {
            foreach (var watcher in _watchers)
            {
                try
                {
                    watcher.Dispose();
                }
                catch { }
            }
            _watchers.Clear();
        }
    }

    private class FileWatchInfo
    {
        public string FilePath { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
        public DateTime DetectedAt { get; set; }
        public DateTime LastUpdate { get; set; }
        public string Reason { get; set; } = string.Empty;
        public int UpdateCount { get; set; } = 1;
        public bool IsBeingProcessed { get; set; }
    }
}