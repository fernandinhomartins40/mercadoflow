using System.Windows;
using Microsoft.Extensions.DependencyInjection;
using MercadoFlow.Desktop.ViewModels;

namespace MercadoFlow.Desktop.Views;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();

        // Configurar ViewModel usando DI
        if (App.ServiceProvider != null)
        {
            DataContext = App.ServiceProvider.GetRequiredService<MainWindowViewModel>();
        }
    }

    protected override void OnClosed(System.EventArgs e)
    {
        // Garantir que a aplicação seja encerrada quando a janela principal for fechada
        Application.Current.Shutdown();
        base.OnClosed(e);
    }
}