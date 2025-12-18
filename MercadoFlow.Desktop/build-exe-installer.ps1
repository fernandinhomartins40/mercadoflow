# Build instalador EXE usando dotnet publish com configuração de single-file
Write-Host "Gerando instalador executavel..." -ForegroundColor Green

$output = "installer-exe"
$exeName = "MercadoFlow-Desktop-Installer.exe"

# Criar pasta de output
if (Test-Path $output) { Remove-Item $output -Recurse -Force }
New-Item -ItemType Directory -Path $output | Out-Null

# Publicar como executavel unico
Write-Host "Compilando aplicacao em arquivo unico..." -ForegroundColor Cyan
dotnet publish src/MercadoFlow.Desktop.csproj `
    -c Release `
    -r win-x64 `
    --self-contained true `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -p:EnableCompressionInSingleFile=true `
    -o $output

if ($LASTEXITCODE -eq 0) {
    # Renomear para nome mais amigavel
    $publishedExe = Join-Path $output "MercadoFlow.Desktop.exe"
    $finalExe = Join-Path $output $exeName

    if (Test-Path $publishedExe) {
        Move-Item $publishedExe $finalExe -Force

        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  INSTALADOR EXE CRIADO!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Arquivo: $finalExe" -ForegroundColor Cyan
        $size = (Get-Item $finalExe).Length / 1MB
        Write-Host ("Tamanho: {0:N2} MB" -f $size) -ForegroundColor Cyan
        Write-Host ""
        Write-Host "EXECUTE ESTE ARQUIVO PARA INSTALAR!" -ForegroundColor Yellow
    }
} else {
    Write-Host "ERRO ao compilar!" -ForegroundColor Red
}
