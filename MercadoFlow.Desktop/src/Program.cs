using System;
using System.Threading.Tasks;
using System.Windows;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using NLog.Extensions.Logging;
using MercadoFlow.Desktop.Configuration;
using MercadoFlow.Desktop.Services;
using MercadoFlow.Desktop.Data;
using MercadoFlow.Desktop.ViewModels;
using Microsoft.EntityFrameworkCore;
using System.IO;

namespace MercadoFlow.Desktop;

public static class Program
{
    [STAThread]
    public static async Task<int> Main(string[] args)
    {
        try
        {
            // Configurar diretórios necessários
            EnsureDirectoriesExist();

            // Criar e configurar o host
            var host = CreateHostBuilder(args).Build();

            // Inicializar banco de dados
            await InitializeDatabaseAsync(host);

            // Iniciar a aplicação WPF
            var app = new App();
            app.InitializeComponent();

            // Configurar container de DI na aplicação
            App.ServiceProvider = host.Services;

            // Iniciar serviços em background
            await host.StartAsync();

            // Executar a aplicação WPF
            var exitCode = app.Run();

            // Parar serviços
            await host.StopAsync();

            return exitCode;
        }
        catch (Exception ex)
        {
            // Log crítico de inicialização
            var logger = NLog.LogManager.GetCurrentClassLogger();
            logger.Fatal(ex, "Erro crítico durante inicialização da aplicação");

            MessageBox.Show(
                $"Erro crítico na inicialização: {ex.Message}\n\nVerifique os logs para mais detalhes.",
                "MercadoFlow - Erro Crítico",
                MessageBoxButton.OK,
                MessageBoxImage.Error);

            return 1;
        }
        finally
        {
            NLog.LogManager.Shutdown();
        }
    }

    private static IHostBuilder CreateHostBuilder(string[] args)
    {
        return Host.CreateDefaultBuilder(args)
            .ConfigureAppConfiguration((context, config) =>
            {
                config.SetBasePath(AppDomain.CurrentDomain.BaseDirectory);
                config.AddJsonFile("appsettings.json", optional: false, reloadOnChange: true);
                config.AddJsonFile($"appsettings.{context.HostingEnvironment.EnvironmentName}.json", optional: true);
                config.AddEnvironmentVariables("MERCADOFLOW_");
                config.AddCommandLine(args);
            })
            .ConfigureLogging((context, logging) =>
            {
                logging.ClearProviders();
                logging.AddNLog();
            })
            .ConfigureServices((context, services) =>
            {
                // Configurações
                services.Configure<AppSettings>(context.Configuration.GetSection("AppSettings"));
                services.Configure<ApiSettings>(context.Configuration.GetSection("ApiSettings"));
                services.Configure<MonitoringSettings>(context.Configuration.GetSection("MonitoringSettings"));
                services.Configure<DatabaseSettings>(context.Configuration.GetSection("DatabaseSettings"));
                services.Configure<SecuritySettings>(context.Configuration.GetSection("SecuritySettings"));
                services.Configure<PerformanceSettings>(context.Configuration.GetSection("PerformanceSettings"));

                // Entity Framework
                services.AddDbContext<MercadoFlowContext>(options =>
                {
                    var connectionString = context.Configuration.GetConnectionString("DefaultConnection")
                        ?? context.Configuration.GetSection("DatabaseSettings:ConnectionString").Value;
                    options.UseSqlite(connectionString);
                });

                // HttpClient
                services.AddHttpClient<IApiService, ApiService>();

                // Serviços principais
                services.AddSingleton<IConfigurationService, ConfigurationService>();
                services.AddSingleton<IEncryptionService, EncryptionService>();
                services.AddSingleton<IFileMonitoringService, FileMonitoringService>();
                services.AddSingleton<IXmlParserService, XmlParserService>();
                services.AddSingleton<IQueueService, QueueService>();
                services.AddSingleton<IApiService, ApiService>();
                services.AddSingleton<IHealthCheckService, HealthCheckService>();
                services.AddSingleton<IAutoUpdaterService, AutoUpdaterService>();

                // Serviço principal orquestrador
                services.AddHostedService<FileProcessingService>();

                // ViewModels
                services.AddTransient<MainWindowViewModel>();
                // Note: ConfigurationWindow and LogViewerWindow use code-behind pattern
            });
    }

    private static void EnsureDirectoriesExist()
    {
        var directories = new[]
        {
            "logs",
            "logs/archived",
            "Data",
            "temp"
        };

        foreach (var directory in directories)
        {
            var fullPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, directory);
            if (!Directory.Exists(fullPath))
            {
                Directory.CreateDirectory(fullPath);
            }
        }
    }

    private static async Task InitializeDatabaseAsync(IHost host)
    {
        using var scope = host.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<MercadoFlowContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

        try
        {
            logger.LogInformation("Inicializando banco de dados...");
            await context.Database.EnsureCreatedAsync();
            logger.LogInformation("Banco de dados inicializado com sucesso");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Erro ao inicializar banco de dados");
            throw;
        }
    }
}