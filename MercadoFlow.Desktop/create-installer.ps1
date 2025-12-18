# Script para criar instalador do MercadoFlow Desktop
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MercadoFlow Desktop - Build Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$PublishPath = "publish"
$InstallerPath = "installer-output"
$Version = "1.0.0"

# Limpar pastas anteriores
Write-Host "[1/4] Limpando pastas anteriores..." -ForegroundColor Yellow
if (Test-Path $InstallerPath) {
    Remove-Item -Path $InstallerPath -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $InstallerPath | Out-Null

# Copiar arquivos publicados
Write-Host "[2/4] Organizando arquivos do instalador..." -ForegroundColor Yellow
$filesDir = "$InstallerPath\files"
New-Item -ItemType Directory -Force -Path $filesDir | Out-Null
Copy-Item -Path "$PublishPath\*" -Destination $filesDir -Recurse

# Criar README
Write-Host "[3/4] Criando documentacao..." -ForegroundColor Yellow
$readme = @"
========================================
  MercadoFlow Desktop Collector v$Version
========================================

INSTALACAO:
-----------
1. Copie a pasta 'files' para: C:\Program Files\MercadoFlow\
2. Crie atalhos conforme necessario
3. Execute MercadoFlow.Desktop.exe

REQUISITOS:
-----------
- Windows 10/11 (64-bit)
- .NET 8 Runtime (incluido)
- 500MB espaco em disco

LOCALIZACAO:
------------
Apos instalacao, o programa estara em:
C:\Program Files\MercadoFlow\

SUPORTE:
--------
Email: suporte@mercadoflow.com
Site: https://mercadoflow.com

========================================
Copyright (c) 2024 MercadoFlow
Todos os direitos reservados.
========================================
"@

Set-Content -Path "$InstallerPath\LEIA-ME.txt" -Value $readme

# Comprimir tudo em ZIP
Write-Host "[4/4] Criando arquivo ZIP..." -ForegroundColor Yellow
$zipFile = "MercadoFlow-Desktop-Portable-v$Version.zip"
if (Test-Path $zipFile) {
    Remove-Item $zipFile -Force
}
Compress-Archive -Path "$InstallerPath\*" -DestinationPath $zipFile -Force

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  INSTALADOR CRIADO COM SUCESSO!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Arquivos criados:" -ForegroundColor Cyan
Write-Host "  - $zipFile" -ForegroundColor White
Write-Host "  - $InstallerPath\" -ForegroundColor White
Write-Host ""
Write-Host "INSTRUCOES:" -ForegroundColor Yellow
Write-Host "1. Extraia o arquivo ZIP" -ForegroundColor White
Write-Host "2. Copie a pasta 'files' para C:\Program Files\MercadoFlow\" -ForegroundColor White
Write-Host "3. Execute MercadoFlow.Desktop.exe" -ForegroundColor White
Write-Host ""
$size = (Get-Item $zipFile).Length / 1MB
Write-Host ("Tamanho do instalador: {0:N2} MB" -f $size) -ForegroundColor Cyan
Write-Host ""
