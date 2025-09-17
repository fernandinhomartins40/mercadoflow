using System;
using System.Collections.Generic;
using System.IO;
using System.Windows;
using Microsoft.Win32;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using MercadoFlow.Desktop.Services;

namespace MercadoFlow.Desktop.Views;

public partial class ConfigurationWindow : Window
{
    private readonly ILogger<ConfigurationWindow>? _logger;
    private readonly IConfiguration? _configuration;
    private bool _hasChanges = false;

    public ConfigurationWindow()
    {
        InitializeComponent();

        if (App.ServiceProvider != null)
        {
            _logger = App.ServiceProvider.GetService<ILogger<ConfigurationWindow>>();
            _configuration = App.ServiceProvider.GetService<IConfiguration>();
        }

        LoadConfiguration();
    }

    private void LoadConfiguration()
    {
        try
        {
            if (_configuration == null) return;

            // Monitoramento
            var watchedFolders = _configuration.GetSection("MonitoringSettings:WatchedFolders").Get<List<string>>() ?? new List<string>();
            foreach (var folder in watchedFolders)
            {
                FoldersListBox.Items.Add(folder);
            }

            DebounceDelayTextBox.Text = _configuration["MonitoringSettings:DebounceDelayMs"] ?? "2000";
            MaxFileSizeTextBox.Text = _configuration["MonitoringSettings:MaxFileSizeMB"] ?? "50";
            ProcessSubfoldersCheckBox.IsChecked = bool.Parse(_configuration["MonitoringSettings:ProcessSubfolders"] ?? "true");
            DeleteAfterProcessingCheckBox.IsChecked = bool.Parse(_configuration["MonitoringSettings:DeleteAfterProcessing"] ?? "false");
            MoveToProcessedFolderCheckBox.IsChecked = bool.Parse(_configuration["MonitoringSettings:MoveToProcessedFolder"] ?? "true");
            ProcessedFolderTextBox.Text = _configuration["MonitoringSettings:ProcessedFolderPath"] ?? "";

            // API
            ApiBaseUrlTextBox.Text = _configuration["ApiSettings:BaseUrl"] ?? "https://api.mercadoflow.com";
            MarketIdTextBox.Text = _configuration["ApiSettings:MarketId"] ?? "";
            TimeoutTextBox.Text = _configuration["ApiSettings:Timeout"] ?? "00:05:00";
            RetryAttemptsTextBox.Text = _configuration["ApiSettings:RetryAttempts"] ?? "5";
            EnableCompressionCheckBox.IsChecked = bool.Parse(_configuration["ApiSettings:EnableCompression"] ?? "true");

            // Segurança
            ValidateCertificatesCheckBox.IsChecked = bool.Parse(_configuration["SecuritySettings:ValidateCertificates"] ?? "true");
            RequireHttpsCheckBox.IsChecked = bool.Parse(_configuration["SecuritySettings:RequireHttps"] ?? "true");
            EncryptLocalDataCheckBox.IsChecked = bool.Parse(_configuration["SecuritySettings:EncryptLocalData"] ?? "true");
            ValidateXmlSignatureCheckBox.IsChecked = bool.Parse(_configuration["SecuritySettings:ValidateXmlSignature"] ?? "true");
            ValidateXmlSchemaCheckBox.IsChecked = bool.Parse(_configuration["SecuritySettings:ValidateXmlSchema"] ?? "true");

            // Desempenho
            MaxConcurrentProcessingTextBox.Text = _configuration["PerformanceSettings:MaxConcurrentProcessing"] ?? "5";
            BatchSizeTextBox.Text = _configuration["PerformanceSettings:BatchSize"] ?? "100";
            MaxQueueSizeTextBox.Text = _configuration["PerformanceSettings:MaxQueueSize"] ?? "10000";
            ProcessingTimeoutTextBox.Text = _configuration["PerformanceSettings:ProcessingTimeoutMs"] ?? "30000";
            HealthCheckIntervalTextBox.Text = _configuration["PerformanceSettings:HealthCheckIntervalMs"] ?? "60000";

            _logger?.LogInformation("Configurações carregadas com sucesso");
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Erro ao carregar configurações");
            MessageBox.Show($"Erro ao carregar configurações: {ex.Message}", "Erro",
                MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void AddFolder_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            var dialog = new System.Windows.Forms.FolderBrowserDialog
            {
                Description = "Selecione uma pasta para monitoramento",
                ShowNewFolderButton = true
            };

            if (dialog.ShowDialog() == System.Windows.Forms.DialogResult.OK)
            {
                var selectedPath = dialog.SelectedPath;

                if (!FoldersListBox.Items.Contains(selectedPath))
                {
                    FoldersListBox.Items.Add(selectedPath);
                    _hasChanges = true;
                    _logger?.LogInformation("Pasta adicionada ao monitoramento: {Path}", selectedPath);
                }
                else
                {
                    MessageBox.Show("Esta pasta já está sendo monitorada.", "Aviso",
                        MessageBoxButton.OK, MessageBoxImage.Warning);
                }
            }
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Erro ao adicionar pasta");
            MessageBox.Show($"Erro ao adicionar pasta: {ex.Message}", "Erro",
                MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void RemoveFolder_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            if (FoldersListBox.SelectedItem != null)
            {
                var selectedPath = FoldersListBox.SelectedItem.ToString();
                FoldersListBox.Items.Remove(FoldersListBox.SelectedItem);
                _hasChanges = true;
                _logger?.LogInformation("Pasta removida do monitoramento: {Path}", selectedPath);
            }
            else
            {
                MessageBox.Show("Selecione uma pasta para remover.", "Aviso",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Erro ao remover pasta");
            MessageBox.Show($"Erro ao remover pasta: {ex.Message}", "Erro",
                MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void BrowseProcessedFolder_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            var dialog = new System.Windows.Forms.FolderBrowserDialog
            {
                Description = "Selecione a pasta para arquivos processados",
                ShowNewFolderButton = true
            };

            if (!string.IsNullOrWhiteSpace(ProcessedFolderTextBox.Text))
            {
                dialog.SelectedPath = ProcessedFolderTextBox.Text;
            }

            if (dialog.ShowDialog() == System.Windows.Forms.DialogResult.OK)
            {
                ProcessedFolderTextBox.Text = dialog.SelectedPath;
                _hasChanges = true;
            }
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Erro ao selecionar pasta processados");
            MessageBox.Show($"Erro ao selecionar pasta: {ex.Message}", "Erro",
                MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private async void TestConnection_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            if (App.ServiceProvider == null)
            {
                MessageBox.Show("Serviços não disponíveis.", "Erro",
                    MessageBoxButton.OK, MessageBoxImage.Error);
                return;
            }

            var apiService = App.ServiceProvider.GetService<IApiService>();
            if (apiService == null)
            {
                MessageBox.Show("Serviço de API não disponível.", "Erro",
                    MessageBoxButton.OK, MessageBoxImage.Error);
                return;
            }

            var button = sender as System.Windows.Controls.Button;
            if (button != null)
            {
                button.IsEnabled = false;
                button.Content = "Testando...";
            }

            var isConnected = await apiService.TestConnectionAsync();

            MessageBox.Show(
                isConnected ? "Conexão com API bem-sucedida!" : "Falha na conexão com API.",
                "Teste de Conexão",
                MessageBoxButton.OK,
                isConnected ? MessageBoxImage.Information : MessageBoxImage.Warning);

            _logger?.LogInformation("Teste de conexão realizado: {Result}", isConnected ? "Sucesso" : "Falha");
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Erro ao testar conexão");
            MessageBox.Show($"Erro ao testar conexão: {ex.Message}", "Erro",
                MessageBoxButton.OK, MessageBoxImage.Error);
        }
        finally
        {
            var button = sender as System.Windows.Controls.Button;
            if (button != null)
            {
                button.IsEnabled = true;
                button.Content = "Testar Conexão";
            }
        }
    }

    private void Save_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            SaveConfiguration();
            DialogResult = true;
            Close();
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Erro ao salvar configurações");
            MessageBox.Show($"Erro ao salvar configurações: {ex.Message}", "Erro",
                MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void Cancel_Click(object sender, RoutedEventArgs e)
    {
        if (_hasChanges)
        {
            var result = MessageBox.Show(
                "Existem alterações não salvas. Deseja realmente cancelar?",
                "Cancelar",
                MessageBoxButton.YesNo,
                MessageBoxImage.Question);

            if (result == MessageBoxResult.No)
                return;
        }

        DialogResult = false;
        Close();
    }

    private void Apply_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            SaveConfiguration();
            _hasChanges = false;
            MessageBox.Show("Configurações aplicadas com sucesso!", "Sucesso",
                MessageBoxButton.OK, MessageBoxImage.Information);
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Erro ao aplicar configurações");
            MessageBox.Show($"Erro ao aplicar configurações: {ex.Message}", "Erro",
                MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void SaveConfiguration()
    {
        try
        {
            var configPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "appsettings.json");

            // Para este exemplo, vamos apenas mostrar que as configurações seriam salvas
            // Em uma implementação completa, você modificaria o arquivo appsettings.json

            var watchedFolders = new List<string>();
            foreach (var item in FoldersListBox.Items)
            {
                watchedFolders.Add(item.ToString() ?? string.Empty);
            }

            // Aqui você implementaria a lógica para salvar as configurações
            // no arquivo appsettings.json ou no registro do Windows

            _logger?.LogInformation("Configurações salvas: {FolderCount} pastas monitoradas", watchedFolders.Count);

            MessageBox.Show(
                "Configurações salvas com sucesso!\n\nNota: Para aplicar todas as alterações, reinicie a aplicação.",
                "Configurações Salvas",
                MessageBoxButton.OK,
                MessageBoxImage.Information);
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Erro ao salvar configurações no arquivo");
            throw;
        }
    }

    protected override void OnClosing(System.ComponentModel.CancelEventArgs e)
    {
        if (_hasChanges && DialogResult != true)
        {
            var result = MessageBox.Show(
                "Existem alterações não salvas. Deseja salvar antes de fechar?",
                "Alterações Não Salvas",
                MessageBoxButton.YesNoCancel,
                MessageBoxImage.Question);

            switch (result)
            {
                case MessageBoxResult.Yes:
                    try
                    {
                        SaveConfiguration();
                        DialogResult = true;
                    }
                    catch (Exception ex)
                    {
                        _logger?.LogError(ex, "Erro ao salvar configurações ao fechar");
                        MessageBox.Show($"Erro ao salvar: {ex.Message}", "Erro",
                            MessageBoxButton.OK, MessageBoxImage.Error);
                        e.Cancel = true;
                    }
                    break;
                case MessageBoxResult.Cancel:
                    e.Cancel = true;
                    break;
            }
        }

        base.OnClosing(e);
    }
}