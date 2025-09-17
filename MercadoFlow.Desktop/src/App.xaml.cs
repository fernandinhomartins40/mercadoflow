using System;
using System.Windows;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace MercadoFlow.Desktop;

public partial class App : Application
{
    public static IServiceProvider? ServiceProvider { get; set; }

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        // Configurar handlers para exceções não tratadas
        DispatcherUnhandledException += OnDispatcherUnhandledException;
        AppDomain.CurrentDomain.UnhandledException += OnUnhandledException;

        // Log de inicialização
        var logger = ServiceProvider?.GetService<ILogger<App>>();
        logger?.LogInformation("Aplicação MercadoFlow Desktop iniciada");
    }

    protected override void OnExit(ExitEventArgs e)
    {
        var logger = ServiceProvider?.GetService<ILogger<App>>();
        logger?.LogInformation("Aplicação MercadoFlow Desktop sendo encerrada");

        base.OnExit(e);
    }

    private void OnDispatcherUnhandledException(object sender, System.Windows.Threading.DispatcherUnhandledExceptionEventArgs e)
    {
        var logger = ServiceProvider?.GetService<ILogger<App>>();
        logger?.LogError(e.Exception, "Exceção não tratada no dispatcher");

        MessageBox.Show(
            $"Erro inesperado: {e.Exception.Message}\n\nA aplicação continuará funcionando, mas verifique os logs para mais detalhes.",
            "MercadoFlow - Erro",
            MessageBoxButton.OK,
            MessageBoxImage.Warning);

        e.Handled = true;
    }

    private void OnUnhandledException(object sender, UnhandledExceptionEventArgs e)
    {
        var logger = ServiceProvider?.GetService<ILogger<App>>();
        logger?.LogCritical(e.ExceptionObject as Exception, "Exceção não tratada crítica");

        if (e.IsTerminating)
        {
            MessageBox.Show(
                $"Erro crítico: {(e.ExceptionObject as Exception)?.Message}\n\nA aplicação será encerrada.",
                "MercadoFlow - Erro Crítico",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
        }
    }
}