# Script para criar instalador do MercadoFlow Desktop
# Este script cria um instalador simples usando dotnet publish e um script de instalação

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MercadoFlow Desktop - Build Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Variáveis
$ProjectPath = "src\MercadoFlow.Desktop.csproj"
$PublishPath = "publish"
$InstallerPath = "installer-output"
$AppName = "MercadoFlow Desktop"
$Version = "1.0.0"

# Limpar pastas anteriores
Write-Host "[1/5] Limpando pastas anteriores..." -ForegroundColor Yellow
if (Test-Path $PublishPath) {
    Remove-Item -Path $PublishPath -Recurse -Force
}
if (Test-Path $InstallerPath) {
    Remove-Item -Path $InstallerPath -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $InstallerPath | Out-Null

# Publicar aplicação
Write-Host "[2/5] Compilando e publicando aplicação..." -ForegroundColor Yellow
$publishCommand = "dotnet publish $ProjectPath -c Release -r win-x64 --self-contained true -p:PublishSingleFile=false -o $PublishPath"
Invoke-Expression $publishCommand

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERRO: Falha ao compilar a aplicação!" -ForegroundColor Red
    Write-Host "Verifique os erros acima e corrija antes de criar o instalador." -ForegroundColor Red
    exit 1
}

Write-Host "✓ Aplicação compilada com sucesso!" -ForegroundColor Green

# Criar script de instalação
Write-Host "[3/5] Criando script de instalação..." -ForegroundColor Yellow

$installScript = @'
@echo off
echo ========================================
echo   MercadoFlow Desktop - Instalador
echo ========================================
echo.

:: Verificar privilégios de administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERRO: Este instalador requer privilegios de administrador!
    echo Por favor, execute como Administrador.
    pause
    exit /b 1
)

:: Definir pasta de instalação
set "INSTALL_DIR=%ProgramFiles%\MercadoFlow"

echo [1/4] Criando pastas de instalacao...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if not exist "%INSTALL_DIR%\Data" mkdir "%INSTALL_DIR%\Data"
if not exist "%INSTALL_DIR%\Logs" mkdir "%INSTALL_DIR%\Logs"
if not exist "%INSTALL_DIR%\Uploads" mkdir "%INSTALL_DIR%\Uploads"

echo [2/4] Copiando arquivos...
xcopy /E /I /Y "%~dp0files\*" "%INSTALL_DIR%\"

echo [3/4] Criando atalhos...
powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%PUBLIC%\Desktop\MercadoFlow Desktop.lnk'); $Shortcut.TargetPath = '%INSTALL_DIR%\MercadoFlow.Desktop.exe'; $Shortcut.WorkingDirectory = '%INSTALL_DIR%'; $Shortcut.Description = 'Coletor automatico de XMLs de vendas'; $Shortcut.Save()"

powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%ProgramData%\Microsoft\Windows\Start Menu\Programs\MercadoFlow Desktop.lnk'); $Shortcut.TargetPath = '%INSTALL_DIR%\MercadoFlow.Desktop.exe'; $Shortcut.WorkingDirectory = '%INSTALL_DIR%'; $Shortcut.Description = 'Coletor automatico de XMLs de vendas'; $Shortcut.Save()"

echo [4/4] Registrando desinstalador...
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\MercadoFlow" /v "DisplayName" /t REG_SZ /d "MercadoFlow Desktop Collector" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\MercadoFlow" /v "DisplayVersion" /t REG_SZ /d "1.0.0" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\MercadoFlow" /v "Publisher" /t REG_SZ /d "MercadoFlow" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\MercadoFlow" /v "InstallLocation" /t REG_SZ /d "%INSTALL_DIR%" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\MercadoFlow" /v "UninstallString" /t REG_SZ /d "%INSTALL_DIR%\uninstall.bat" /f

echo.
echo ========================================
echo   Instalacao concluida com sucesso!
echo ========================================
echo.
echo O MercadoFlow Desktop foi instalado em:
echo %INSTALL_DIR%
echo.
echo Atalhos criados:
echo - Area de Trabalho
echo - Menu Iniciar
echo.
pause
'@

Set-Content -Path "$InstallerPath\install.bat" -Value $installScript

# Criar script de desinstalação
$uninstallScript = @'
@echo off
echo ========================================
echo MercadoFlow Desktop - Desinstalador
echo ========================================
echo.

:: Verificar privilégios
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERRO: Requer privilegios de administrador!
    pause
    exit /b 1
)

set "INSTALL_DIR=%ProgramFiles%\MercadoFlow"

echo Removendo atalhos...
del "%PUBLIC%\Desktop\MercadoFlow Desktop.lnk" 2>nul
del "%ProgramData%\Microsoft\Windows\Start Menu\Programs\MercadoFlow Desktop.lnk" 2>nul

echo Removendo registro...
reg delete "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\MercadoFlow" /f 2>nul

echo Removendo arquivos...
timeout /t 2 /nobreak >nul
rd /s /q "%INSTALL_DIR%" 2>nul

echo.
echo Desinstalacao concluida!
pause
'@

# Copiar arquivos publicados
Write-Host "[4/5] Organizando arquivos do instalador..." -ForegroundColor Yellow
$filesDir = "$InstallerPath\files"
New-Item -ItemType Directory -Force -Path $filesDir | Out-Null
Copy-Item -Path "$PublishPath\*" -Destination $filesDir -Recurse
Set-Content -Path "$filesDir\uninstall.bat" -Value $uninstallScript

# Criar README
Write-Host "[5/5] Criando documentação..." -ForegroundColor Yellow
$readme = @"
========================================
  MercadoFlow Desktop Collector v$Version
========================================

INSTALAÇÃO:
-----------
1. Clique com botão direito em 'install.bat'
2. Selecione 'Executar como administrador'
3. Siga as instruções na tela

REQUISITOS:
-----------
- Windows 10/11 (64-bit)
- .NET 8 Runtime (incluído)
- 500MB espaço em disco

LOCALIZAÇÃO:
------------
Após instalação, o programa estará em:
C:\Program Files\MercadoFlow\

ATALHOS:
--------
- Área de Trabalho
- Menu Iniciar

DESINSTALAÇÃO:
--------------
Execute: C:\Program Files\MercadoFlow\uninstall.bat
(como administrador)

SUPORTE:
--------
Email: suporte@mercadoflow.com
Site: https://mercadoflow.com

========================================
Copyright © 2024 MercadoFlow
Todos os direitos reservados.
========================================
"@

Set-Content -Path "$InstallerPath\LEIA-ME.txt" -Value $readme

# Comprimir tudo em ZIP
Write-Host ""
Write-Host "Criando arquivo ZIP..." -ForegroundColor Yellow
$zipFile = "MercadoFlow-Desktop-Installer-v$Version.zip"
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
Write-Host "INSTRUÇÕES:" -ForegroundColor Yellow
Write-Host "1. Extraia o arquivo ZIP" -ForegroundColor White
Write-Host "2. Execute 'install.bat' como Administrador" -ForegroundColor White
Write-Host "3. Siga as instruções na tela" -ForegroundColor White
Write-Host ""
Write-Host "Tamanho do instalador: $((Get-Item $zipFile).Length / 1MB | ForEach-Object {"{0:N2}" -f $_}) MB" -ForegroundColor Cyan
Write-Host ""
