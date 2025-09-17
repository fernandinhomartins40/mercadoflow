using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Win32;

namespace MercadoFlow.Desktop.Services;

public class ConfigurationService : IConfigurationService
{
    private readonly ILogger<ConfigurationService> _logger;
    private readonly IEncryptionService _encryptionService;
    private readonly Dictionary<string, object> _configuration = new();
    private readonly object _lockObject = new();
    private readonly string _configFilePath;
    private readonly string _registryPath = @"SOFTWARE\MercadoFlow\Desktop";

    public event EventHandler<ConfigurationChangedEventArgs>? ConfigurationChanged;

    public ConfigurationService(ILogger<ConfigurationService> logger, IEncryptionService encryptionService)
    {
        _logger = logger;
        _encryptionService = encryptionService;
        _configFilePath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "MercadoFlow",
            "config.json");

        EnsureConfigDirectoryExists();
    }

    public T GetValue<T>(string key, T defaultValue = default!)
    {
        if (string.IsNullOrWhiteSpace(key))
            throw new ArgumentException("Key cannot be null or empty", nameof(key));

        lock (_lockObject)
        {
            if (_configuration.TryGetValue(key, out var value))
            {
                try
                {
                    if (value is JsonElement jsonElement)
                    {
                        return JsonSerializer.Deserialize<T>(jsonElement.GetRawText()) ?? defaultValue;
                    }

                    if (value is T directValue)
                    {
                        return directValue;
                    }

                    // Tentar converter
                    return (T)Convert.ChangeType(value, typeof(T)) ?? defaultValue;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Erro ao converter valor da configuração {Key} para tipo {Type}. Usando valor padrão.",
                        key, typeof(T).Name);
                    return defaultValue;
                }
            }

            _logger.LogDebug("Chave de configuração {Key} não encontrada. Usando valor padrão: {DefaultValue}",
                key, defaultValue);
            return defaultValue;
        }
    }

    public async Task SetValueAsync<T>(string key, T value)
    {
        if (string.IsNullOrWhiteSpace(key))
            throw new ArgumentException("Key cannot be null or empty", nameof(key));

        object? oldValue;

        lock (_lockObject)
        {
            _configuration.TryGetValue(key, out oldValue);
            _configuration[key] = value!;
        }

        _logger.LogDebug("Configuração alterada: {Key} = {Value}", key, value);

        // Notificar mudança
        ConfigurationChanged?.Invoke(this, new ConfigurationChangedEventArgs
        {
            Key = key,
            OldValue = oldValue,
            NewValue = value
        });

        // Auto-save para configurações críticas
        if (IsCriticalSetting(key))
        {
            await SaveAsync();
        }
    }

    public async Task<bool> SaveAsync()
    {
        try
        {
            Dictionary<string, object> configToSave;

            lock (_lockObject)
            {
                configToSave = new Dictionary<string, object>(_configuration);
            }

            var json = JsonSerializer.Serialize(configToSave, new JsonSerializerOptions
            {
                WriteIndented = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            // Criptografar dados sensíveis
            var encryptedData = await _encryptionService.EncryptAsync(json);

            await File.WriteAllBytesAsync(_configFilePath, encryptedData);

            // Salvar configurações não-sensíveis no registro também (backup)
            await SaveToRegistryAsync(configToSave);

            _logger.LogInformation("Configurações salvas com sucesso em {ConfigFilePath}", _configFilePath);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao salvar configurações");
            return false;
        }
    }

    public async Task LoadAsync()
    {
        try
        {
            if (File.Exists(_configFilePath))
            {
                await LoadFromFileAsync();
            }
            else
            {
                // Tentar carregar do registro como fallback
                await LoadFromRegistryAsync();
            }

            _logger.LogInformation("Configurações carregadas com sucesso");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao carregar configurações. Usando configurações padrão.");
            await ResetToDefaultsAsync();
        }
    }

    public async Task ResetToDefaultsAsync()
    {
        lock (_lockObject)
        {
            _configuration.Clear();
        }

        // Carregar configurações padrão
        await LoadDefaultConfigurationAsync();

        _logger.LogInformation("Configurações resetadas para valores padrão");

        // Salvar as configurações padrão
        await SaveAsync();
    }

    private async Task LoadFromFileAsync()
    {
        try
        {
            var encryptedData = await File.ReadAllBytesAsync(_configFilePath);
            var json = await _encryptionService.DecryptAsync(encryptedData);

            var configData = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(json);

            if (configData != null)
            {
                lock (_lockObject)
                {
                    _configuration.Clear();
                    foreach (var kvp in configData)
                    {
                        _configuration[kvp.Key] = kvp.Value;
                    }
                }
            }

            _logger.LogDebug("Configurações carregadas do arquivo: {Count} itens", configData?.Count ?? 0);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao carregar configurações do arquivo");
            throw;
        }
    }

    private async Task LoadFromRegistryAsync()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(_registryPath);
            if (key == null)
            {
                _logger.LogDebug("Chave do registro não encontrada: {RegistryPath}", _registryPath);
                return;
            }

            var configCount = 0;
            lock (_lockObject)
            {
                _configuration.Clear();

                foreach (var valueName in key.GetValueNames())
                {
                    if (!IsSensitiveSetting(valueName))
                    {
                        var value = key.GetValue(valueName);
                        if (value != null)
                        {
                            _configuration[valueName] = value;
                            configCount++;
                        }
                    }
                }
            }

            _logger.LogDebug("Configurações carregadas do registro: {Count} itens", configCount);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao carregar configurações do registro");
        }
    }

    private async Task SaveToRegistryAsync(Dictionary<string, object> config)
    {
        try
        {
            using var key = Registry.CurrentUser.CreateSubKey(_registryPath);

            foreach (var kvp in config)
            {
                // Não salvar dados sensíveis no registro
                if (!IsSensitiveSetting(kvp.Key))
                {
                    key.SetValue(kvp.Key, kvp.Value);
                }
            }

            _logger.LogDebug("Configurações não-sensíveis salvas no registro");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao salvar configurações no registro");
        }
    }

    private async Task LoadDefaultConfigurationAsync()
    {
        var defaults = new Dictionary<string, object>
        {
            // Monitoramento
            ["MonitoringSettings.DebounceDelayMs"] = 2000,
            ["MonitoringSettings.MaxFileSizeMB"] = 50,
            ["MonitoringSettings.ProcessSubfolders"] = true,
            ["MonitoringSettings.DeleteAfterProcessing"] = false,
            ["MonitoringSettings.MoveToProcessedFolder"] = true,
            ["MonitoringSettings.ProcessedFolderPath"] = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "MercadoFlow", "Processados"),

            // API
            ["ApiSettings.BaseUrl"] = "https://api.mercadoflow.com",
            ["ApiSettings.Timeout"] = "00:05:00",
            ["ApiSettings.RetryAttempts"] = 5,
            ["ApiSettings.EnableCompression"] = true,

            // Segurança
            ["SecuritySettings.ValidateCertificates"] = true,
            ["SecuritySettings.RequireHttps"] = true,
            ["SecuritySettings.EncryptLocalData"] = true,
            ["SecuritySettings.ValidateXmlSignature"] = true,
            ["SecuritySettings.ValidateXmlSchema"] = true,

            // Performance
            ["PerformanceSettings.MaxConcurrentProcessing"] = 5,
            ["PerformanceSettings.BatchSize"] = 100,
            ["PerformanceSettings.MaxQueueSize"] = 10000,
            ["PerformanceSettings.ProcessingTimeoutMs"] = 30000,
            ["PerformanceSettings.HealthCheckIntervalMs"] = 60000,

            // Aplicação
            ["AppSettings.AutoStart"] = false,
            ["AppSettings.AutoUpdate"] = true,
            ["AppSettings.UpdateCheckInterval"] = "24:00:00",

            // UI
            ["UI.WindowState"] = "Normal",
            ["UI.WindowWidth"] = 1200,
            ["UI.WindowHeight"] = 800,
            ["UI.Theme"] = "Light"
        };

        lock (_lockObject)
        {
            foreach (var kvp in defaults)
            {
                _configuration[kvp.Key] = kvp.Value;
            }
        }

        _logger.LogDebug("Configurações padrão carregadas: {Count} itens", defaults.Count);
    }

    private void EnsureConfigDirectoryExists()
    {
        var directory = Path.GetDirectoryName(_configFilePath);
        if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
        {
            Directory.CreateDirectory(directory);
            _logger.LogDebug("Diretório de configuração criado: {Directory}", directory);
        }
    }

    private static bool IsSensitiveSetting(string key)
    {
        var sensitiveKeys = new[]
        {
            "ApiSettings.ApiKey",
            "ApiSettings.MarketId",
            "SecuritySettings.EncryptionKey",
            "Database.Password"
        };

        foreach (var sensitiveKey in sensitiveKeys)
        {
            if (key.Contains(sensitiveKey, StringComparison.OrdinalIgnoreCase))
                return true;
        }

        return false;
    }

    private static bool IsCriticalSetting(string key)
    {
        var criticalKeys = new[]
        {
            "ApiSettings.BaseUrl",
            "ApiSettings.ApiKey",
            "MonitoringSettings.WatchedFolders",
            "SecuritySettings"
        };

        foreach (var criticalKey in criticalKeys)
        {
            if (key.Contains(criticalKey, StringComparison.OrdinalIgnoreCase))
                return true;
        }

        return false;
    }
}