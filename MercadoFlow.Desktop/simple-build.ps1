# Build simples do MercadoFlow Desktop
Write-Host "Compilando MercadoFlow Desktop..." -ForegroundColor Cyan

# Publicar aplicação
dotnet publish src\MercadoFlow.Desktop.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=false -o publish

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Compilação concluída com sucesso!" -ForegroundColor Green
    Write-Host "Arquivos em: publish\" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Para executar: .\publish\MercadoFlow.Desktop.exe" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "Erro na compilação!" -ForegroundColor Red
}
