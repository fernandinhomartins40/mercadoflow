using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Threading.Tasks;
using System.Windows.Input;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using MercadoFlow.Desktop.Models;
using MercadoFlow.Desktop.Services;

namespace MercadoFlow.Desktop.ViewModels;

public class MainWindowViewModel : INotifyPropertyChanged
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<MainWindowViewModel> _logger;

    private IFileMonitoringService? _fileMonitoringService;
    private IQueueService? _queueService;
    private IApiService? _apiService;

    // Properties para binding
    private ServiceStatus _serviceStatus = ServiceStatus.Stopped;
    private ConnectivityStatus _connectivityStatus = ConnectivityStatus.Unknown;
    private ProcessingStatistics _statistics = new();
    private QueueStatistics _queueStatistics = new();
    private string _statusMessage = "Aplicação iniciada";
    private bool _isStartButtonEnabled = true;
    private bool _isStopButtonEnabled = false;

    public MainWindowViewModel(IServiceProvider serviceProvider, ILogger<MainWindowViewModel> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;

        // Commands
        StartCommand = new RelayCommand(async () => await StartServiceAsync(), () => IsStartButtonEnabled);
        StopCommand = new RelayCommand(async () => await StopServiceAsync(), () => IsStopButtonEnabled);
        TestConnectionCommand = new RelayCommand(async () => await TestConnectionAsync());
        RefreshCommand = new RelayCommand(async () => await RefreshDataAsync());
        OpenConfigurationCommand = new RelayCommand(OpenConfiguration);
        OpenLogsCommand = new RelayCommand(OpenLogs);

        // Collections
        RecentFiles = new ObservableCollection<ProcessedFileViewModel>();
        Alerts = new ObservableCollection<AlertViewModel>();
        QueueItems = new ObservableCollection<QueueItemViewModel>();

        InitializeAsync();
    }

    #region Properties

    public ServiceStatus ServiceStatus
    {
        get => _serviceStatus;
        set
        {
            if (_serviceStatus != value)
            {
                _serviceStatus = value;
                OnPropertyChanged();
                OnPropertyChanged(nameof(ServiceStatusText));
                OnPropertyChanged(nameof(ServiceStatusColor));
                UpdateButtonStates();
            }
        }
    }

    public ConnectivityStatus ConnectivityStatus
    {
        get => _connectivityStatus;
        set
        {
            if (_connectivityStatus != value)
            {
                _connectivityStatus = value;
                OnPropertyChanged();
                OnPropertyChanged(nameof(ConnectivityStatusText));
                OnPropertyChanged(nameof(ConnectivityStatusColor));
            }
        }
    }

    public ProcessingStatistics Statistics
    {
        get => _statistics;
        set
        {
            _statistics = value;
            OnPropertyChanged();
        }
    }

    public QueueStatistics QueueStatistics
    {
        get => _queueStatistics;
        set
        {
            _queueStatistics = value;
            OnPropertyChanged();
        }
    }

    public string StatusMessage
    {
        get => _statusMessage;
        set
        {
            if (_statusMessage != value)
            {
                _statusMessage = value;
                OnPropertyChanged();
            }
        }
    }

    public bool IsStartButtonEnabled
    {
        get => _isStartButtonEnabled;
        set
        {
            if (_isStartButtonEnabled != value)
            {
                _isStartButtonEnabled = value;
                OnPropertyChanged();
            }
        }
    }

    public bool IsStopButtonEnabled
    {
        get => _isStopButtonEnabled;
        set
        {
            if (_isStopButtonEnabled != value)
            {
                _isStopButtonEnabled = value;
                OnPropertyChanged();
            }
        }
    }

    // Status text properties
    public string ServiceStatusText => ServiceStatus switch
    {
        ServiceStatus.Stopped => "Parado",
        ServiceStatus.Starting => "Iniciando...",
        ServiceStatus.Running => "Executando",
        ServiceStatus.Stopping => "Parando...",
        ServiceStatus.Error => "Erro",
        ServiceStatus.Paused => "Pausado",
        _ => "Desconhecido"
    };

    public string ServiceStatusColor => ServiceStatus switch
    {
        ServiceStatus.Running => "#4CAF50",
        ServiceStatus.Error => "#F44336",
        ServiceStatus.Starting or ServiceStatus.Stopping => "#FF9800",
        _ => "#757575"
    };

    public string ConnectivityStatusText => ConnectivityStatus switch
    {
        ConnectivityStatus.Connected => "Conectado",
        ConnectivityStatus.Disconnected => "Desconectado",
        ConnectivityStatus.Connecting => "Conectando...",
        ConnectivityStatus.Error => "Erro de Conexão",
        _ => "Desconhecido"
    };

    public string ConnectivityStatusColor => ConnectivityStatus switch
    {
        ConnectivityStatus.Connected => "#4CAF50",
        ConnectivityStatus.Disconnected or ConnectivityStatus.Error => "#F44336",
        ConnectivityStatus.Connecting => "#FF9800",
        _ => "#757575"
    };

    #endregion

    #region Collections

    public ObservableCollection<ProcessedFileViewModel> RecentFiles { get; }
    public ObservableCollection<AlertViewModel> Alerts { get; }
    public ObservableCollection<QueueItemViewModel> QueueItems { get; }

    #endregion

    #region Commands

    public ICommand StartCommand { get; }
    public ICommand StopCommand { get; }
    public ICommand TestConnectionCommand { get; }
    public ICommand RefreshCommand { get; }
    public ICommand OpenConfigurationCommand { get; }
    public ICommand OpenLogsCommand { get; }

    #endregion

    #region Private Methods

    private async void InitializeAsync()
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();

            _fileMonitoringService = scope.ServiceProvider.GetService<IFileMonitoringService>();
            _queueService = scope.ServiceProvider.GetService<IQueueService>();
            _apiService = scope.ServiceProvider.GetService<IApiService>();

            if (_fileMonitoringService != null)
            {
                _fileMonitoringService.StatusChanged += OnMonitoringStatusChanged;
            }

            if (_apiService != null)
            {
                _apiService.ConnectivityChanged += OnConnectivityChanged;
                ConnectivityStatus = _apiService.GetConnectionStatus();
            }

            await RefreshDataAsync();

            _logger.LogInformation("MainWindowViewModel inicializado");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao inicializar MainWindowViewModel");
            StatusMessage = $"Erro na inicialização: {ex.Message}";
        }
    }

    private async Task StartServiceAsync()
    {
        try
        {
            StatusMessage = "Iniciando serviços...";
            ServiceStatus = ServiceStatus.Starting;

            if (_fileMonitoringService != null)
            {
                await _fileMonitoringService.StartMonitoringAsync();
            }

            StatusMessage = "Serviços iniciados com sucesso";
            ServiceStatus = ServiceStatus.Running;

            _logger.LogInformation("Serviços iniciados pelo usuário");
        }
        catch (Exception ex)
        {
            ServiceStatus = ServiceStatus.Error;
            StatusMessage = $"Erro ao iniciar serviços: {ex.Message}";
            _logger.LogError(ex, "Erro ao iniciar serviços");
        }
    }

    private async Task StopServiceAsync()
    {
        try
        {
            StatusMessage = "Parando serviços...";
            ServiceStatus = ServiceStatus.Stopping;

            if (_fileMonitoringService != null)
            {
                await _fileMonitoringService.StopMonitoringAsync();
            }

            StatusMessage = "Serviços parados";
            ServiceStatus = ServiceStatus.Stopped;

            _logger.LogInformation("Serviços parados pelo usuário");
        }
        catch (Exception ex)
        {
            ServiceStatus = ServiceStatus.Error;
            StatusMessage = $"Erro ao parar serviços: {ex.Message}";
            _logger.LogError(ex, "Erro ao parar serviços");
        }
    }

    private async Task TestConnectionAsync()
    {
        try
        {
            StatusMessage = "Testando conexão com API...";

            if (_apiService != null)
            {
                var isConnected = await _apiService.TestConnectionAsync();
                StatusMessage = isConnected ? "Conexão com API bem-sucedida" : "Falha na conexão com API";
            }
            else
            {
                StatusMessage = "Serviço de API não disponível";
            }
        }
        catch (Exception ex)
        {
            StatusMessage = $"Erro ao testar conexão: {ex.Message}";
            _logger.LogError(ex, "Erro ao testar conexão");
        }
    }

    private async Task RefreshDataAsync()
    {
        try
        {
            // Atualizar estatísticas
            if (_fileMonitoringService != null)
            {
                Statistics = _fileMonitoringService.GetStatistics();
            }

            if (_queueService != null)
            {
                QueueStatistics = await _queueService.GetStatisticsAsync();

                // Atualizar itens da fila
                var queueItems = await _queueService.GetQueueItemsAsync(take: 20);
                QueueItems.Clear();
                foreach (var item in queueItems)
                {
                    QueueItems.Add(new QueueItemViewModel(item));
                }
            }

            // Simular alguns alertas para demonstração
            UpdateAlerts();

            StatusMessage = $"Dados atualizados - {DateTime.Now:HH:mm:ss}";
        }
        catch (Exception ex)
        {
            StatusMessage = $"Erro ao atualizar dados: {ex.Message}";
            _logger.LogError(ex, "Erro ao atualizar dados");
        }
    }

    private void UpdateAlerts()
    {
        Alerts.Clear();

        // Alertas baseados no status do serviço
        if (ServiceStatus == ServiceStatus.Error)
        {
            Alerts.Add(new AlertViewModel
            {
                Type = AlertType.Error,
                Title = "Erro no Serviço",
                Message = "O serviço de monitoramento está com erro",
                Timestamp = DateTime.Now
            });
        }

        if (ConnectivityStatus == ConnectivityStatus.Disconnected)
        {
            Alerts.Add(new AlertViewModel
            {
                Type = AlertType.Warning,
                Title = "API Desconectada",
                Message = "Não foi possível conectar com a API",
                Timestamp = DateTime.Now
            });
        }

        if (QueueStatistics.ErrorItems > 0)
        {
            Alerts.Add(new AlertViewModel
            {
                Type = AlertType.Warning,
                Title = "Itens com Erro na Fila",
                Message = $"{QueueStatistics.ErrorItems} itens falharam no envio",
                Timestamp = DateTime.Now
            });
        }

        if (QueueStatistics.DeadLetterItems > 0)
        {
            Alerts.Add(new AlertViewModel
            {
                Type = AlertType.Error,
                Title = "Itens em Dead Letter",
                Message = $"{QueueStatistics.DeadLetterItems} itens foram movidos para dead letter",
                Timestamp = DateTime.Now
            });
        }
    }

    private void OpenConfiguration()
    {
        try
        {
            var configWindow = new Views.ConfigurationWindow();
            configWindow.ShowDialog();
        }
        catch (Exception ex)
        {
            StatusMessage = $"Erro ao abrir configurações: {ex.Message}";
            _logger.LogError(ex, "Erro ao abrir janela de configurações");
        }
    }

    private void OpenLogs()
    {
        try
        {
            var logsWindow = new Views.LogViewerWindow();
            logsWindow.ShowDialog();
        }
        catch (Exception ex)
        {
            StatusMessage = $"Erro ao abrir logs: {ex.Message}";
            _logger.LogError(ex, "Erro ao abrir janela de logs");
        }
    }

    private void OnMonitoringStatusChanged(object? sender, MonitoringStatusEventArgs e)
    {
        App.Current?.Dispatcher.Invoke(() =>
        {
            ServiceStatus = e.Status;
            StatusMessage = e.Message ?? string.Empty;
        });
    }

    private void OnConnectivityChanged(object? sender, ConnectivityStatusEventArgs e)
    {
        App.Current?.Dispatcher.Invoke(() =>
        {
            ConnectivityStatus = e.Status;
            StatusMessage = e.Message ?? string.Empty;
        });
    }

    private void UpdateButtonStates()
    {
        IsStartButtonEnabled = ServiceStatus is ServiceStatus.Stopped or ServiceStatus.Error;
        IsStopButtonEnabled = ServiceStatus is ServiceStatus.Running or ServiceStatus.Starting;
    }

    #endregion

    #region INotifyPropertyChanged

    public event PropertyChangedEventHandler? PropertyChanged;

    protected virtual void OnPropertyChanged([CallerMemberName] string? propertyName = null)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }

    #endregion
}

// ViewModels auxiliares
public class ProcessedFileViewModel
{
    public string FileName { get; set; } = string.Empty;
    public DateTime ProcessedAt { get; set; }
    public ProcessingStatus Status { get; set; }
    public string StatusText => Status.ToString();
    public string StatusColor => Status switch
    {
        ProcessingStatus.Completed => "#4CAF50",
        ProcessingStatus.Error => "#F44336",
        ProcessingStatus.Processing => "#FF9800",
        _ => "#757575"
    };
}

public class AlertViewModel
{
    public AlertType Type { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public string TypeText => Type.ToString();
    public string TypeColor => Type switch
    {
        AlertType.Error or AlertType.Critical => "#F44336",
        AlertType.Warning => "#FF9800",
        AlertType.Success => "#4CAF50",
        AlertType.Information => "#2196F3",
        _ => "#757575"
    };
}

public class QueueItemViewModel
{
    public QueueItemViewModel(QueueItem item)
    {
        ChaveNFe = item.ChaveNFe;
        Status = item.Status;
        Tentativas = item.Tentativas;
        DataCriacao = item.DataCriacao;
        ErroDetalhes = item.ErroDetalhes;
    }

    public string ChaveNFe { get; set; }
    public QueueStatus Status { get; set; }
    public int Tentativas { get; set; }
    public DateTime DataCriacao { get; set; }
    public string? ErroDetalhes { get; set; }

    public string StatusText => Status switch
    {
        QueueStatus.Pending => "Pendente",
        QueueStatus.Processing => "Processando",
        QueueStatus.Sent => "Enviado",
        QueueStatus.Error => "Erro",
        QueueStatus.DeadLetter => "Dead Letter",
        QueueStatus.Retry => "Retry",
        _ => "Desconhecido"
    };

    public string StatusColor => Status switch
    {
        QueueStatus.Sent => "#4CAF50",
        QueueStatus.Error or QueueStatus.DeadLetter => "#F44336",
        QueueStatus.Processing or QueueStatus.Retry => "#FF9800",
        _ => "#757575"
    };
}

// RelayCommand implementation
public class RelayCommand : ICommand
{
    private readonly Action _execute;
    private readonly Func<bool>? _canExecute;

    public RelayCommand(Action execute, Func<bool>? canExecute = null)
    {
        _execute = execute ?? throw new ArgumentNullException(nameof(execute));
        _canExecute = canExecute;
    }

    public event EventHandler? CanExecuteChanged
    {
        add { CommandManager.RequerySuggested += value; }
        remove { CommandManager.RequerySuggested -= value; }
    }

    public bool CanExecute(object? parameter)
    {
        return _canExecute?.Invoke() ?? true;
    }

    public void Execute(object? parameter)
    {
        _execute();
    }
}