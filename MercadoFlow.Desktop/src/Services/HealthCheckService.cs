using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MercadoFlow.Desktop.Configuration;
using MercadoFlow.Desktop.Data;
using MercadoFlow.Desktop.Models;

namespace MercadoFlow.Desktop.Services;

public class HealthCheckService : IHealthCheckService
{
    private readonly ILogger<HealthCheckService> _logger;
    private readonly IServiceProvider _serviceProvider;
    private readonly PerformanceSettings _performanceSettings;
    private readonly Timer _healthCheckTimer;
    private SystemHealth? _lastHealth;
    private readonly object _lockObject = new();

    public event EventHandler<HealthStatusChangedEventArgs>? HealthStatusChanged;

    public HealthCheckService(
        ILogger<HealthCheckService> logger,
        IServiceProvider serviceProvider,
        IOptions<PerformanceSettings> performanceSettings)
    {
        _logger = logger;
        _serviceProvider = serviceProvider;
        _performanceSettings = performanceSettings.Value;

        // Timer para health check periódico
        var interval = TimeSpan.FromMilliseconds(_performanceSettings.HealthCheckIntervalMs);
        _healthCheckTimer = new Timer(PeriodicHealthCheck, null, interval, interval);
    }

    public async Task<SystemHealth> GetSystemHealthAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var health = new SystemHealth
            {
                Timestamp = DateTime.UtcNow,
                Version = typeof(HealthCheckService).Assembly.GetName().Version?.ToString() ?? "1.0.0"
            };

            // Verificar status dos serviços
            await CheckServiceStatusAsync(health, cancellationToken);

            // Verificar conectividade da API
            await CheckApiConnectivityAsync(health, cancellationToken);

            // Verificar saúde do banco de dados
            await CheckDatabaseHealthAsync(health, cancellationToken);

            // Verificar recursos do sistema
            CheckSystemResources(health);

            // Verificar espaço em disco
            CheckDiskSpace(health);

            // Calcular uptime
            CalculateUptime(health);

            _logger.LogDebug("Health check concluído. Status: {ServiceStatus}, API: {ApiStatus}, DB: {DbStatus}",
                health.ServiceStatus, health.ApiConnectivity, health.DatabaseHealth);

            return health;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro durante health check");

            return new SystemHealth
            {
                Timestamp = DateTime.UtcNow,
                ServiceStatus = ServiceStatus.Error,
                ApiConnectivity = ConnectivityStatus.Error,
                DatabaseHealth = false,
                LastError = DateTime.UtcNow,
                LastErrorMessage = ex.Message,
                Version = "1.0.0"
            };
        }
    }

    public async Task<bool> IsHealthyAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var health = await GetSystemHealthAsync(cancellationToken);

            return health.ServiceStatus == ServiceStatus.Running &&
                   health.ApiConnectivity == ConnectivityStatus.Connected &&
                   health.DatabaseHealth &&
                   health.MemoryUsage < 1024 * 1024 * 1024 && // < 1GB
                   health.DiskSpace > 1024 * 1024 * 1024; // > 1GB
        }
        catch
        {
            return false;
        }
    }

    public async Task<Dictionary<string, object>> GetDiagnosticsAsync(CancellationToken cancellationToken = default)
    {
        var diagnostics = new Dictionary<string, object>();

        try
        {
            var health = await GetSystemHealthAsync(cancellationToken);

            // Informações do sistema
            diagnostics["Timestamp"] = health.Timestamp;
            diagnostics["Version"] = health.Version;
            diagnostics["MachineName"] = System.Environment.MachineName;
            diagnostics["UserName"] = System.Environment.UserName;
            diagnostics["OSVersion"] = System.Environment.OSVersion.ToString();
            diagnostics["ProcessorCount"] = System.Environment.ProcessorCount;
            diagnostics["WorkingDirectory"] = System.Environment.CurrentDirectory;

            // Status dos serviços
            diagnostics["ServiceStatus"] = health.ServiceStatus.ToString();
            diagnostics["ApiConnectivity"] = health.ApiConnectivity.ToString();
            diagnostics["DatabaseHealth"] = health.DatabaseHealth;

            // Recursos do sistema
            diagnostics["MemoryUsage"] = $"{health.MemoryUsage / (1024 * 1024)} MB";
            diagnostics["CpuUsage"] = $"{health.CpuUsage:F1}%";
            diagnostics["DiskSpace"] = $"{health.DiskSpace / (1024 * 1024 * 1024)} GB";
            diagnostics["ActiveConnections"] = health.ActiveConnections;

            // Uptime
            diagnostics["Uptime"] = health.Uptime.ToString(@"dd\.hh\:mm\:ss");

            // Últimos erros
            if (health.LastError.HasValue)
            {
                diagnostics["LastError"] = health.LastError.Value;
                diagnostics["LastErrorMessage"] = health.LastErrorMessage ?? "Desconhecido";
            }

            // Estatísticas adicionais
            await AddServiceDiagnosticsAsync(diagnostics, cancellationToken);

            _logger.LogDebug("Diagnósticos coletados: {Count} itens", diagnostics.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao coletar diagnósticos");
            diagnostics["Error"] = ex.Message;
        }

        return diagnostics;
    }

    private async Task CheckServiceStatusAsync(SystemHealth health, CancellationToken cancellationToken)
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var fileMonitoringService = scope.ServiceProvider.GetService<IFileMonitoringService>();

            if (fileMonitoringService != null)
            {
                health.ServiceStatus = fileMonitoringService.IsMonitoring ? ServiceStatus.Running : ServiceStatus.Stopped;
                health.LastSuccessfulSync = DateTime.UtcNow; // Simulate last sync
            }
            else
            {
                health.ServiceStatus = ServiceStatus.Error;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao verificar status dos serviços");
            health.ServiceStatus = ServiceStatus.Error;
            health.LastError = DateTime.UtcNow;
            health.LastErrorMessage = ex.Message;
        }
    }

    private async Task CheckApiConnectivityAsync(SystemHealth health, CancellationToken cancellationToken)
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var apiService = scope.ServiceProvider.GetService<IApiService>();

            if (apiService != null)
            {
                health.ApiConnectivity = apiService.GetConnectionStatus();

                // Se status for desconhecido, fazer teste de conectividade
                if (health.ApiConnectivity == ConnectivityStatus.Unknown)
                {
                    var isConnected = await apiService.TestConnectionAsync(cancellationToken);
                    health.ApiConnectivity = isConnected ? ConnectivityStatus.Connected : ConnectivityStatus.Disconnected;
                }
            }
            else
            {
                health.ApiConnectivity = ConnectivityStatus.Error;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao verificar conectividade da API");
            health.ApiConnectivity = ConnectivityStatus.Error;
        }
    }

    private async Task CheckDatabaseHealthAsync(SystemHealth health, CancellationToken cancellationToken)
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetService<MercadoFlowContext>();

            if (context != null)
            {
                // Teste simples de conectividade - contar itens da fila
                var queueCount = await context.QueueItems.CountAsync(cancellationToken);
                health.DatabaseHealth = true;

                _logger.LogDebug("Banco de dados saudável. Itens na fila: {QueueCount}", queueCount);
            }
            else
            {
                health.DatabaseHealth = false;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao verificar saúde do banco de dados");
            health.DatabaseHealth = false;
            health.LastError = DateTime.UtcNow;
            health.LastErrorMessage = ex.Message;
        }
    }

    private void CheckSystemResources(SystemHealth health)
    {
        try
        {
            // Memória do processo atual
            using var process = Process.GetCurrentProcess();
            health.MemoryUsage = process.WorkingSet64;

            // CPU - estimativa simples baseada no tempo do processo
            var totalProcessorTime = process.TotalProcessorTime;
            var realTime = DateTime.UtcNow - process.StartTime;
            if (realTime.TotalMilliseconds > 0)
            {
                health.CpuUsage = (totalProcessorTime.TotalMilliseconds / realTime.TotalMilliseconds / System.Environment.ProcessorCount) * 100;
            }

            // Conexões ativas (estimativa baseada em threads)
            health.ActiveConnections = process.Threads.Count;

            _logger.LogDebug("Recursos do sistema: Memória={MemoryMB}MB, CPU={CpuUsage:F1}%, Threads={ThreadCount}",
                health.MemoryUsage / (1024 * 1024), health.CpuUsage, health.ActiveConnections);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao verificar recursos do sistema");
        }
    }

    private void CheckDiskSpace(SystemHealth health)
    {
        try
        {
            var currentDrive = Path.GetPathRoot(System.Environment.CurrentDirectory);
            if (!string.IsNullOrEmpty(currentDrive))
            {
                var driveInfo = new DriveInfo(currentDrive);
                if (driveInfo.IsReady)
                {
                    health.DiskSpace = driveInfo.AvailableFreeSpace;
                    _logger.LogDebug("Espaço em disco disponível: {DiskSpaceGB}GB",
                        health.DiskSpace / (1024 * 1024 * 1024));
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao verificar espaço em disco");
        }
    }

    private void CalculateUptime(SystemHealth health)
    {
        try
        {
            using var process = Process.GetCurrentProcess();
            health.Uptime = DateTime.UtcNow - process.StartTime;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao calcular uptime");
        }
    }

    private async Task AddServiceDiagnosticsAsync(Dictionary<string, object> diagnostics, CancellationToken cancellationToken)
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();

            // Estatísticas da fila
            var queueService = scope.ServiceProvider.GetService<IQueueService>();
            if (queueService != null)
            {
                var queueStats = await queueService.GetStatisticsAsync();
                diagnostics["QueueSize"] = queueStats.TotalItems;
                diagnostics["QueuePending"] = queueStats.PendingItems;
                diagnostics["QueueErrors"] = queueStats.ErrorItems;
                diagnostics["QueueSuccessRate"] = $"{queueStats.SuccessRate:F1}%";
            }

            // Estatísticas do monitoramento
            var fileMonitoringService = scope.ServiceProvider.GetService<IFileMonitoringService>();
            if (fileMonitoringService != null)
            {
                var monitoringStats = fileMonitoringService.GetStatistics();
                diagnostics["FilesProcessedToday"] = monitoringStats.FilesProcessedToday;
                diagnostics["FilesErrorToday"] = monitoringStats.FilesErrorToday;
                diagnostics["WatchedFolders"] = monitoringStats.ActiveWatchers;
            }

            // Estatísticas da API
            var apiService = scope.ServiceProvider.GetService<IApiService>();
            if (apiService != null)
            {
                var apiStats = apiService.GetStatistics();
                diagnostics["ApiRequests"] = apiStats.TotalRequests;
                diagnostics["ApiSuccessRate"] = $"{apiStats.SuccessRate:F1}%";
                diagnostics["ApiAverageResponseTime"] = $"{apiStats.AverageResponseTime.TotalMilliseconds:F0}ms";
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao adicionar diagnósticos dos serviços");
        }
    }

    private async void PeriodicHealthCheck(object? state)
    {
        try
        {
            var currentHealth = await GetSystemHealthAsync();

            lock (_lockObject)
            {
                if (_lastHealth != null && HasSignificantChange(_lastHealth, currentHealth))
                {
                    HealthStatusChanged?.Invoke(this, new HealthStatusChangedEventArgs
                    {
                        CurrentHealth = currentHealth,
                        PreviousHealth = _lastHealth,
                        Timestamp = DateTime.UtcNow
                    });

                    _logger.LogInformation("Status de saúde alterado: Serviço={ServiceStatus}, API={ApiStatus}, DB={DbStatus}",
                        currentHealth.ServiceStatus, currentHealth.ApiConnectivity, currentHealth.DatabaseHealth);
                }

                _lastHealth = currentHealth;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro durante health check periódico");
        }
    }

    private static bool HasSignificantChange(SystemHealth previous, SystemHealth current)
    {
        return previous.ServiceStatus != current.ServiceStatus ||
               previous.ApiConnectivity != current.ApiConnectivity ||
               previous.DatabaseHealth != current.DatabaseHealth ||
               Math.Abs(previous.CpuUsage - current.CpuUsage) > 20 || // Mudança de CPU > 20%
               Math.Abs(previous.MemoryUsage - current.MemoryUsage) > 100 * 1024 * 1024; // Mudança de memória > 100MB
    }

    public void Dispose()
    {
        _healthCheckTimer?.Dispose();
    }
}