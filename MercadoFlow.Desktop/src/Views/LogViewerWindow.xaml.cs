using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Windows;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Win32;
using MercadoFlow.Desktop.Data;
using MercadoFlow.Desktop.Models;

namespace MercadoFlow.Desktop.Views;

public partial class LogViewerWindow : Window
{
    private readonly ILogger<LogViewerWindow>? _logger;
    private readonly MercadoFlowContext? _context;
    private List<LogEntry> _allLogs = new();

    public LogViewerWindow()
    {
        InitializeComponent();

        if (App.ServiceProvider != null)
        {
            _logger = App.ServiceProvider.GetService<ILogger<LogViewerWindow>>();
            _context = App.ServiceProvider.GetService<MercadoFlowContext>();
        }

        LoadLogs();
    }

    private async void LoadLogs()
    {
        try
        {
            StatusTextBlock.Text = "Carregando logs...";
            _allLogs.Clear();

            // Carregar logs do banco de dados
            if (_context != null)
            {
                var dbLogs = await _context.ErrorLogs
                    .OrderByDescending(l => l.Timestamp)
                    .Take(1000)
                    .ToListAsync();

                foreach (var dbLog in dbLogs)
                {
                    _allLogs.Add(new LogEntry
                    {
                        Timestamp = dbLog.Timestamp,
                        Level = dbLog.Level.ToString(),
                        Source = dbLog.Source ?? "Unknown",
                        Message = dbLog.Message,
                        Exception = dbLog.Exception
                    });
                }
            }

            // Carregar logs de arquivo
            await LoadFileLogsAsync();

            // Preencher fontes no ComboBox
            PopulateSourceComboBox();

            // Aplicar filtros
            ApplyFilters();

            StatusTextBlock.Text = $"{_allLogs.Count} logs carregados";
            _logger?.LogInformation("Logs carregados: {Count} entradas", _allLogs.Count);
        }
        catch (Exception ex)
        {
            StatusTextBlock.Text = "Erro ao carregar logs";
            _logger?.LogError(ex, "Erro ao carregar logs");
            MessageBox.Show($"Erro ao carregar logs: {ex.Message}", "Erro",
                MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private async Task LoadFileLogsAsync()
    {
        try
        {
            var logsDirectory = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "logs");
            if (!Directory.Exists(logsDirectory))
                return;

            // Carregar logs estruturados (JSON)
            var jsonLogFiles = Directory.GetFiles(logsDirectory, "*structured*.json", SearchOption.TopDirectoryOnly)
                .OrderByDescending(f => new FileInfo(f).LastWriteTime)
                .Take(5); // Últimos 5 arquivos

            foreach (var logFile in jsonLogFiles)
            {
                try
                {
                    var lines = await File.ReadAllLinesAsync(logFile);
                    foreach (var line in lines.Take(500)) // Máximo 500 linhas por arquivo
                    {
                        if (string.IsNullOrWhiteSpace(line))
                            continue;

                        try
                        {
                            var logEntry = JsonSerializer.Deserialize<JsonLogEntry>(line);
                            if (logEntry != null)
                            {
                                _allLogs.Add(new LogEntry
                                {
                                    Timestamp = logEntry.Timestamp,
                                    Level = logEntry.Level ?? "INFO",
                                    Source = logEntry.Logger ?? "Application",
                                    Message = logEntry.Message ?? string.Empty,
                                    Exception = logEntry.Exception
                                });
                            }
                        }
                        catch
                        {
                            // Ignorar linhas que não são JSON válido
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger?.LogWarning(ex, "Erro ao ler arquivo de log: {LogFile}", logFile);
                }
            }

            // Carregar logs de texto simples
            var textLogFiles = Directory.GetFiles(logsDirectory, "mercadoflow-*.log", SearchOption.TopDirectoryOnly)
                .OrderByDescending(f => new FileInfo(f).LastWriteTime)
                .Take(3); // Últimos 3 arquivos

            foreach (var logFile in textLogFiles)
            {
                try
                {
                    var lines = await File.ReadAllLinesAsync(logFile);
                    foreach (var line in lines.TakeLast(200)) // Últimas 200 linhas por arquivo
                    {
                        if (string.IsNullOrWhiteSpace(line))
                            continue;

                        var logEntry = ParseTextLogLine(line);
                        if (logEntry != null)
                        {
                            _allLogs.Add(logEntry);
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger?.LogWarning(ex, "Erro ao ler arquivo de log de texto: {LogFile}", logFile);
                }
            }
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Erro ao carregar logs de arquivo");
        }
    }

    private LogEntry? ParseTextLogLine(string line)
    {
        try
        {
            // Formato esperado: 2024-01-01 12:00:00.000|0|INFO|Source|Message
            var parts = line.Split('|');
            if (parts.Length < 5)
                return null;

            if (!DateTime.TryParse(parts[0], out var timestamp))
                return null;

            return new LogEntry
            {
                Timestamp = timestamp,
                Level = parts[2]?.Trim() ?? "INFO",
                Source = parts[3]?.Trim() ?? "Application",
                Message = string.Join("|", parts.Skip(4))?.Trim() ?? string.Empty
            };
        }
        catch
        {
            return null;
        }
    }

    private void PopulateSourceComboBox()
    {
        var sources = _allLogs
            .Select(l => l.Source)
            .Distinct()
            .OrderBy(s => s)
            .ToList();

        SourceComboBox.Items.Clear();
        SourceComboBox.Items.Add(new System.Windows.Controls.ComboBoxItem { Content = "Todas", IsSelected = true });

        foreach (var source in sources)
        {
            SourceComboBox.Items.Add(new System.Windows.Controls.ComboBoxItem { Content = source });
        }
    }

    private void ApplyFilters()
    {
        try
        {
            var filteredLogs = _allLogs.AsEnumerable();

            // Filtro por nível
            var selectedLevel = (LogLevelComboBox.SelectedItem as System.Windows.Controls.ComboBoxItem)?.Content?.ToString();
            if (!string.IsNullOrEmpty(selectedLevel) && selectedLevel != "Todos")
            {
                filteredLogs = filteredLogs.Where(l => l.Level.Equals(selectedLevel, StringComparison.OrdinalIgnoreCase));
            }

            // Filtro por fonte
            var selectedSource = (SourceComboBox.SelectedItem as System.Windows.Controls.ComboBoxItem)?.Content?.ToString();
            if (!string.IsNullOrEmpty(selectedSource) && selectedSource != "Todas")
            {
                filteredLogs = filteredLogs.Where(l => l.Source.Equals(selectedSource, StringComparison.OrdinalIgnoreCase));
            }

            // Filtro por busca
            var searchText = SearchTextBox.Text?.Trim();
            if (!string.IsNullOrEmpty(searchText))
            {
                filteredLogs = filteredLogs.Where(l =>
                    l.Message.Contains(searchText, StringComparison.OrdinalIgnoreCase) ||
                    l.Source.Contains(searchText, StringComparison.OrdinalIgnoreCase));
            }

            var results = filteredLogs
                .OrderByDescending(l => l.Timestamp)
                .Take(500) // Limitar a 500 entradas para performance
                .ToList();

            LogItemsControl.ItemsSource = results;
            StatusTextBlock.Text = $"{results.Count} logs exibidos de {_allLogs.Count} total";
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Erro ao aplicar filtros");
            StatusTextBlock.Text = "Erro ao aplicar filtros";
        }
    }

    private void Refresh_Click(object sender, RoutedEventArgs e)
    {
        LoadLogs();
    }

    private void Export_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            var saveDialog = new SaveFileDialog
            {
                Filter = "Arquivo CSV (*.csv)|*.csv|Arquivo de Texto (*.txt)|*.txt",
                DefaultExt = "csv",
                FileName = $"mercadoflow-logs-{DateTime.Now:yyyyMMdd-HHmmss}"
            };

            if (saveDialog.ShowDialog() == true)
            {
                var logs = LogItemsControl.ItemsSource as List<LogEntry> ?? new List<LogEntry>();
                ExportLogs(saveDialog.FileName, logs, saveDialog.FilterIndex == 1);

                MessageBox.Show($"Logs exportados com sucesso para:\n{saveDialog.FileName}",
                    "Export Concluído", MessageBoxButton.OK, MessageBoxImage.Information);

                _logger?.LogInformation("Logs exportados: {FilePath}, {Count} entradas", saveDialog.FileName, logs.Count);
            }
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Erro ao exportar logs");
            MessageBox.Show($"Erro ao exportar logs: {ex.Message}", "Erro",
                MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void ExportLogs(string filePath, List<LogEntry> logs, bool csvFormat)
    {
        using var writer = new StreamWriter(filePath);

        if (csvFormat)
        {
            // Header CSV
            writer.WriteLine("Timestamp,Level,Source,Message,Exception");

            foreach (var log in logs)
            {
                writer.WriteLine($"\"{log.Timestamp:yyyy-MM-dd HH:mm:ss}\",\"{log.Level}\",\"{log.Source}\",\"{EscapeCsv(log.Message)}\",\"{EscapeCsv(log.Exception)}\"");
            }
        }
        else
        {
            // Formato texto
            foreach (var log in logs)
            {
                writer.WriteLine($"[{log.Timestamp:yyyy-MM-dd HH:mm:ss}] {log.Level} - {log.Source}");
                writer.WriteLine($"Message: {log.Message}");
                if (!string.IsNullOrEmpty(log.Exception))
                {
                    writer.WriteLine($"Exception: {log.Exception}");
                }
                writer.WriteLine(new string('-', 80));
            }
        }
    }

    private static string EscapeCsv(string? value)
    {
        if (string.IsNullOrEmpty(value))
            return string.Empty;

        return value.Replace("\"", "\"\"").Replace("\n", " ").Replace("\r", " ");
    }

    private void Close_Click(object sender, RoutedEventArgs e)
    {
        Close();
    }

    private void LogLevelComboBox_SelectionChanged(object sender, System.Windows.Controls.SelectionChangedEventArgs e)
    {
        if (LogItemsControl != null)
            ApplyFilters();
    }

    private void SourceComboBox_SelectionChanged(object sender, System.Windows.Controls.SelectionChangedEventArgs e)
    {
        if (LogItemsControl != null)
            ApplyFilters();
    }

    private void SearchTextBox_TextChanged(object sender, System.Windows.Controls.TextChangedEventArgs e)
    {
        if (LogItemsControl != null)
            ApplyFilters();
    }
}

// Classes auxiliares para logs
public class LogEntry
{
    public DateTime Timestamp { get; set; }
    public string Level { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? Exception { get; set; }

    public string LevelColor => Level.ToUpperInvariant() switch
    {
        "ERROR" or "CRITICAL" => "#F44336",
        "WARNING" => "#FF9800",
        "INFORMATION" or "INFO" => "#2196F3",
        "DEBUG" => "#9C27B0",
        "TRACE" => "#607D8B",
        _ => "#757575"
    };
}

public class JsonLogEntry
{
    public DateTime Timestamp { get; set; }
    public string? Level { get; set; }
    public string? Logger { get; set; }
    public string? Message { get; set; }
    public string? Exception { get; set; }
}