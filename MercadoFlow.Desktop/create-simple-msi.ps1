# Script para criar MSI usando WiX-Sharp (alternativa simples ao WiX)
Write-Host "Instalando WixSharp via NuGet..." -ForegroundColor Green

# Criar pasta temporaria para o script WixSharp
$wixDir = "wix-build"
if (Test-Path $wixDir) { Remove-Item $wixDir -Recurse -Force }
New-Item -ItemType Directory -Path $wixDir | Out-Null

# Instalar WixSharp
dotnet new console -n WixBuilder -o $wixDir
Set-Location $wixDir
dotnet add package WixSharp --version 2.3.0

# Criar script WixSharp
$wixScript = @'
using System;
using WixSharp;
using WixSharp.CommonTasks;

class Script
{
    static void Main()
    {
        var project = new Project("MercadoFlow Desktop Collector",
            new Dir(@"%ProgramFiles%\MercadoFlow",
                new Files(@"..\publish\*.*"),
                new Dir("Data"),
                new Dir("Logs"),
                new Dir("Uploads")),
            new Dir(@"%ProgramMenu%\MercadoFlow",
                new ExeFileShortcut("MercadoFlow Desktop", "[INSTALLDIR]MercadoFlow.Desktop.exe", "")),
            new Dir(@"%Desktop%",
                new ExeFileShortcut("MercadoFlow Desktop", "[INSTALLDIR]MercadoFlow.Desktop.exe", "")));

        project.GUID = new Guid("A1B2C3D4-E5F6-4A5B-8C9D-0E1F2A3B4C5D");
        project.Version = new Version("1.0.0");
        project.ControlPanelInfo.Manufacturer = "MercadoFlow";
        project.ControlPanelInfo.ProductIcon = "app.ico";
        project.OutFileName = "MercadoFlow-Desktop-Setup";
        project.OutDir = "..";

        project.BuildMsi();
    }
}
'@

Set-Content -Path "Program.cs" -Value $wixScript

Write-Host "Compilando instalador MSI..." -ForegroundColor Cyan
dotnet run

Set-Location ..

if (Test-Path "MercadoFlow-Desktop-Setup.msi") {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  MSI CRIADO COM SUCESSO!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Arquivo: MercadoFlow-Desktop-Setup.msi" -ForegroundColor Cyan
    $size = (Get-Item "MercadoFlow-Desktop-Setup.msi").Length / 1MB
    Write-Host ("Tamanho: {0:N2} MB" -f $size) -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Execute o arquivo MSI para instalar!" -ForegroundColor Yellow
} else {
    Write-Host "Erro ao criar MSI. Usando alternativa..." -ForegroundColor Yellow

    # Fallback: Criar instalador ClickOnce-style usando MSIX
    Write-Host "Criando instalador MSIX..." -ForegroundColor Cyan

    dotnet tool install --global Microsoft.Windows.SDK.BuildTools

    # Publicar como MSIX (Windows 10/11)
    dotnet publish ..\src\MercadoFlow.Desktop.csproj `
        -c Release `
        -r win10-x64 `
        --self-contained true `
        -p:PublishProfile=win10-x64 `
        -p:GenerateAppxPackageOnBuild=true `
        -o msix-output
}
