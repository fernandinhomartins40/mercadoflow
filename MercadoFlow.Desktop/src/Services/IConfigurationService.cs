using System;
using System.Threading.Tasks;

namespace MercadoFlow.Desktop.Services;

public interface IConfigurationService
{
    T GetValue<T>(string key, T defaultValue = default!);
    Task SetValueAsync<T>(string key, T value);
    Task<bool> SaveAsync();
    Task LoadAsync();
    Task ResetToDefaultsAsync();
    event EventHandler<ConfigurationChangedEventArgs> ConfigurationChanged;
}

public class ConfigurationChangedEventArgs : EventArgs
{
    public required string Key { get; init; }
    public object? OldValue { get; init; }
    public object? NewValue { get; init; }
    public DateTime Timestamp { get; init; } = DateTime.UtcNow;
}