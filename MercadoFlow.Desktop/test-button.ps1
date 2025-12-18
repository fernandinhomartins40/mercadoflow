# Script de teste para verificar se a aplicação está compilada corretamente
Write-Host "Testando aplicação MercadoFlow Desktop..." -ForegroundColor Cyan
Write-Host ""

# Verificar se o executável existe
$exePath = "src\bin\Release\net8.0-windows\MercadoFlow.Desktop.exe"
if (Test-Path $exePath) {
    Write-Host "✓ Executável encontrado: $exePath" -ForegroundColor Green

    # Verificar tamanho
    $size = (Get-Item $exePath).Length / 1KB
    Write-Host "  Tamanho: $([math]::Round($size, 2)) KB" -ForegroundColor Gray
} else {
    Write-Host "✗ Executável não encontrado!" -ForegroundColor Red
    exit 1
}

# Verificar DLLs importantes
$dlls = @(
    "Microsoft.Extensions.DependencyInjection.dll",
    "Microsoft.Extensions.Logging.dll",
    "System.Windows.Input.dll"
)

$binPath = "src\bin\Release\net8.0-windows"
foreach ($dll in $dlls) {
    $dllPath = Join-Path $binPath $dll
    if (Test-Path $dllPath) {
        Write-Host "✓ $dll" -ForegroundColor Green
    } else {
        Write-Host "✗ $dll (não encontrado)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Verificando logs para erros recentes..." -ForegroundColor Cyan

# Verificar se há logs
$logsPath = "C:\Program Files\MercadoFlow\Logs"
if (Test-Path $logsPath) {
    Write-Host "✓ Pasta de logs encontrada: $logsPath" -ForegroundColor Green

    # Pegar último log
    $latestLog = Get-ChildItem $logsPath -Filter "*.log" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($latestLog) {
        Write-Host "  Último log: $($latestLog.Name)" -ForegroundColor Gray
        Write-Host "  Data: $($latestLog.LastWriteTime)" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Últimas 20 linhas do log:" -ForegroundColor Yellow
        Get-Content $latestLog.FullName -Tail 20
    }
} else {
    Write-Host "✗ Pasta de logs não encontrada (aplicação não foi executada?)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Para testar a aplicação:" -ForegroundColor Cyan
Write-Host "1. Execute: C:\Program Files\MercadoFlow\MercadoFlow.Desktop.exe" -ForegroundColor White
Write-Host "2. Clique em qualquer botão" -ForegroundColor White
Write-Host "3. Verifique os logs em: $logsPath" -ForegroundColor White
