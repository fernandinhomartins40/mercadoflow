# Script para corrigir erros de compilação

Write-Host "Corrigindo erros de compilação..." -ForegroundColor Green

# Adicionar usando em LogViewerWindow.xaml.cs
$file = "src\Views\LogViewerWindow.xaml.cs"
$content = Get-Content $file -Raw
if ($content -notlike "*using Microsoft.EntityFrameworkCore;*") {
    $content = $content -replace "using Microsoft.Extensions.Logging;", "using Microsoft.Extensions.Logging;`r`nusing Microsoft.EntityFrameworkCore;"
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "✓ Adicionado using EntityFrameworkCore em LogViewerWindow.xaml.cs" -ForegroundColor Cyan
}

# Adicionar usando em HealthCheckService.cs
$file = "src\Services\HealthCheckService.cs"
$content = Get-Content $file -Raw
if ($content -notlike "*using Microsoft.EntityFrameworkCore;*") {
    $content = $content -replace "using Microsoft.Extensions.Logging;", "using Microsoft.Extensions.Logging;`r`nusing Microsoft.EntityFrameworkCore;"
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "✓ Adicionado using EntityFrameworkCore em HealthCheckService.cs" -ForegroundColor Cyan
}

# Corrigir ambiguidade Environment em HealthCheckService.cs
$file = "src\Services\HealthCheckService.cs"
$content = Get-Content $file -Raw
$content = $content -replace "Environment\.MachineName", "System.Environment.MachineName"
$content = $content -replace "Environment\.UserName", "System.Environment.UserName"
$content = $content -replace "Environment\.OSVersion", "System.Environment.OSVersion"
$content = $content -replace "Environment\.ProcessorCount", "System.Environment.ProcessorCount"
$content = $content -replace "Environment\.Is64BitOperatingSystem", "System.Environment.Is64BitOperatingSystem"
$content = $content -replace "Environment\.WorkingSet", "System.Environment.WorkingSet"
Set-Content -Path $file -Value $content -NoNewline
Write-Host "✓ Corrigido ambiguidade Environment em HealthCheckService.cs" -ForegroundColor Cyan

# Corrigir ambiguidade Environment e LogLevel em FileProcessingService.cs
$file = "src\Services\FileProcessingService.cs"
$content = Get-Content $file -Raw
$content = $content -replace "Environment\.MachineName", "System.Environment.MachineName"
$content = $content -replace "(?<!Models\.)LogLevel\.Error", "Models.LogLevel.Error"
Set-Content -Path $file -Value $content -NoNewline
Write-Host "✓ Corrigido ambiguidades em FileProcessingService.cs" -ForegroundColor Cyan

# Adicionar using em Program.cs
$file = "src\Program.cs"
$content = Get-Content $file -Raw
if ($content -notlike "*using MercadoFlow.Desktop.Parsers;*") {
    $content = $content -replace "using MercadoFlow.Desktop.Services;", "using MercadoFlow.Desktop.Services;`r`nusing MercadoFlow.Desktop.Parsers;"
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "✓ Adicionado using Parsers em Program.cs" -ForegroundColor Cyan
}

# Adicionar package HttpClient se necessário
$csprojFile = "src\MercadoFlow.Desktop.csproj"
$content = Get-Content $csprojFile -Raw
if ($content -notlike "*Microsoft.Extensions.Http*") {
    $content = $content -replace "(<PackageReference Include=""Polly"" Version=""8.2.0"" />)", "`$1`r`n    <PackageReference Include=""Microsoft.Extensions.Http"" Version=""8.0.0"" />"
    Set-Content -Path $csprojFile -Value $content -NoNewline
    Write-Host "✓ Adicionado Microsoft.Extensions.Http ao projeto" -ForegroundColor Cyan
}

Write-Host "`nErros corrigidos! Executando dotnet restore..." -ForegroundColor Green
cd src
dotnet restore

Write-Host "`nTodos os erros foram corrigidos!" -ForegroundColor Green
