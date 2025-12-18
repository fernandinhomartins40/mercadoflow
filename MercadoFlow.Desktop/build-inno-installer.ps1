# Script para criar instalador com Inno Setup
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Criando Instalador MercadoFlow Desktop" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Publicar aplicação
Write-Host "[1/3] Publicando aplicacao..." -ForegroundColor Cyan
dotnet publish src\MercadoFlow.Desktop.csproj -c Release -r win-x64 --self-contained true -o publish-setup

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO ao publicar!" -ForegroundColor Red
    exit 1
}

# Criar script Inno Setup
Write-Host "[2/3] Criando script de instalacao..." -ForegroundColor Cyan

$innoScript = @'
#define MyAppName "MercadoFlow Desktop"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "MercadoFlow"
#define MyAppExeName "MercadoFlow.Desktop.exe"
#define MyAppURL "https://mercadoflow.com"

[Setup]
AppId={{A1B2C3D4-E5F6-4A5B-8C9D-0E1F2A3B4C5D}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\MercadoFlow
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
LicenseFile=LICENSE.txt
OutputDir=installer-output
OutputBaseFilename=MercadoFlow-Desktop-Setup-v{#MyAppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\{#MyAppExeName}
SetupIconFile=
DisableProgramGroupPage=yes

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "publish-setup\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Dirs]
Name: "{app}\Data"; Permissions: users-full
Name: "{app}\Logs"; Permissions: users-full
Name: "{app}\Uploads"; Permissions: users-full

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#MyAppName}}"; Flags: nowait postinstall skipifsilent

[Code]
function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
begin
  Result := True;
end;
'@

New-Item -ItemType Directory -Path "installer-output" -Force | Out-Null
Set-Content -Path "installer-script.iss" -Value $innoScript -Encoding UTF8

Write-Host "[3/3] Verificando Inno Setup..." -ForegroundColor Cyan

# Verificar se Inno Setup está instalado
$innoPath = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if (Test-Path $innoPath) {
    Write-Host "Compilando com Inno Setup..." -ForegroundColor Yellow
    & $innoPath "installer-script.iss"

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  INSTALADOR CRIADO COM SUCESSO!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Arquivo: installer-output\MercadoFlow-Desktop-Setup-v1.0.0.exe" -ForegroundColor Cyan
        if (Test-Path "installer-output\MercadoFlow-Desktop-Setup-v1.0.0.exe") {
            $size = (Get-Item "installer-output\MercadoFlow-Desktop-Setup-v1.0.0.exe").Length / 1MB
            Write-Host ("Tamanho: {0:N2} MB" -f $size) -ForegroundColor Cyan
        }
        Write-Host ""
        Write-Host "Execute este arquivo para instalar!" -ForegroundColor Yellow
    } else {
        Write-Host "ERRO ao compilar instalador!" -ForegroundColor Red
    }
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "  INNO SETUP NAO ENCONTRADO" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Criando instalador alternativo (ZIP com BAT)..." -ForegroundColor Cyan

    # Criar instalador BAT como fallback
    $batInstaller = @'
@echo off
title MercadoFlow Desktop - Instalador v1.0.0
color 0A
cls

echo ========================================
echo   MercadoFlow Desktop - Instalador
echo ========================================
echo.

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERRO: Execute como Administrador!
    echo.
    echo Clique com botao direito em INSTALAR.bat
    echo e selecione "Executar como administrador"
    echo.
    pause
    exit /b 1
)

set "INSTALL_DIR=%ProgramFiles%\MercadoFlow"

echo [1/6] Criando diretorios...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
mkdir "%INSTALL_DIR%\Data" 2>nul
mkdir "%INSTALL_DIR%\Logs" 2>nul
mkdir "%INSTALL_DIR%\Uploads" 2>nul

echo [2/6] Copiando arquivos...
xcopy /E /I /Y "%~dp0files" "%INSTALL_DIR%"

echo [3/6] Configurando permissoes...
icacls "%INSTALL_DIR%\Data" /grant Users:(OI)(CI)F /T >nul 2>&1
icacls "%INSTALL_DIR%\Logs" /grant Users:(OI)(CI)F /T >nul 2>&1
icacls "%INSTALL_DIR%\Uploads" /grant Users:(OI)(CI)F /T >nul 2>&1

echo [4/6] Criando atalhos...
powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%PUBLIC%\Desktop\MercadoFlow Desktop.lnk'); $Shortcut.TargetPath = '%INSTALL_DIR%\MercadoFlow.Desktop.exe'; $Shortcut.WorkingDirectory = '%INSTALL_DIR%'; $Shortcut.Save()"

powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%ProgramData%\Microsoft\Windows\Start Menu\Programs\MercadoFlow Desktop.lnk'); $Shortcut.TargetPath = '%INSTALL_DIR%\MercadoFlow.Desktop.exe'; $Shortcut.WorkingDirectory = '%INSTALL_DIR%'; $Shortcut.Save()"

echo [5/6] Registrando no Windows...
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\MercadoFlow" /v "DisplayName" /t REG_SZ /d "MercadoFlow Desktop" /f >nul
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\MercadoFlow" /v "DisplayVersion" /t REG_SZ /d "1.0.0" /f >nul
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\MercadoFlow" /v "Publisher" /t REG_SZ /d "MercadoFlow" /f >nul
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\MercadoFlow" /v "InstallLocation" /t REG_SZ /d "%INSTALL_DIR%" /f >nul
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\MercadoFlow" /v "UninstallString" /t REG_SZ /d "%INSTALL_DIR%\Desinstalar.bat" /f >nul
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\MercadoFlow" /v "DisplayIcon" /t REG_SZ /d "%INSTALL_DIR%\MercadoFlow.Desktop.exe" /f >nul

echo [6/6] Criando desinstalador...
(
echo @echo off
echo title MercadoFlow Desktop - Desinstalador
echo color 0C
echo cls
echo.
echo net session ^>nul 2^>^&1
echo if %%errorLevel%% neq 0 ^(
echo     echo ERRO: Execute como Administrador!
echo     pause
echo     exit /b 1
echo ^)
echo.
echo echo Removendo atalhos...
echo del "%PUBLIC%\Desktop\MercadoFlow Desktop.lnk" 2^>nul
echo del "%ProgramData%\Microsoft\Windows\Start Menu\Programs\MercadoFlow Desktop.lnk" 2^>nul
echo.
echo echo Removendo registro...
echo reg delete "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\MercadoFlow" /f 2^>nul
echo.
echo echo Encerrando processos...
echo taskkill /F /IM MercadoFlow.Desktop.exe 2^>nul
echo timeout /t 2 /nobreak ^>nul
echo.
echo echo Removendo arquivos...
echo cd /d "%%ProgramFiles%%"
echo rd /s /q "MercadoFlow" 2^>nul
echo.
echo echo Desinstalacao concluida!
echo pause
) > "%INSTALL_DIR%\Desinstalar.bat"

cls
echo.
echo ========================================
echo   INSTALACAO CONCLUIDA!
echo ========================================
echo.
echo Instalado em: %INSTALL_DIR%
echo.
echo Atalhos criados:
echo - Area de Trabalho
echo - Menu Iniciar
echo.
echo Para desinstalar: %INSTALL_DIR%\Desinstalar.bat
echo.
echo.
echo Deseja executar agora? (S/N)
set /p "run="
if /i "%run%"=="S" start "" "%INSTALL_DIR%\MercadoFlow.Desktop.exe"
echo.
pause
'@

    # Criar estrutura do instalador
    $installerDir = "instalador-final"
    if (Test-Path $installerDir) { Remove-Item $installerDir -Recurse -Force }
    New-Item -ItemType Directory -Path $installerDir | Out-Null
    New-Item -ItemType Directory -Path "$installerDir\files" | Out-Null

    # Copiar arquivos publicados
    Copy-Item -Path "publish-setup\*" -Destination "$installerDir\files" -Recurse -Force

    # Salvar instalador BAT
    Set-Content -Path "$installerDir\INSTALAR.bat" -Value $batInstaller -Encoding ASCII

    # Copiar licença
    Copy-Item -Path "LICENSE.txt" -Destination "$installerDir\" -Force

    # Criar README
    $readme = @"
INSTALADOR MERCADOFLOW DESKTOP v1.0.0
======================================

COMO INSTALAR:
1. Clique com botao direito em INSTALAR.bat
2. Selecione "Executar como administrador"
3. Aguarde a instalacao completa

REQUISITOS:
- Windows 10/11 (64-bit)
- Privilegios de administrador
- 150 MB de espaco em disco

LOCALIZACAO APOS INSTALACAO:
C:\Program Files\MercadoFlow\

COMO USAR:
1. Apos instalar, o atalho estara na Area de Trabalho
2. Configure as pastas de monitoramento na aplicacao
3. A aplicacao coletara automaticamente as notas fiscais XML

DESINSTALAR:
Execute como administrador:
C:\Program Files\MercadoFlow\Desinstalar.bat

SUPORTE:
Email: suporte@mercadoflow.com
Site: https://mercadoflow.com
"@

    Set-Content -Path "$installerDir\LEIA-ME.txt" -Value $readme -Encoding UTF8

    # Criar ZIP
    $zipName = "MercadoFlow-Desktop-Instalador.zip"
    if (Test-Path $zipName) { Remove-Item $zipName -Force }
    Compress-Archive -Path "$installerDir\*" -DestinationPath $zipName -Force

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  INSTALADOR ZIP CRIADO!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Arquivo: $zipName" -ForegroundColor Cyan
    $size = (Get-Item $zipName).Length / 1MB
    Write-Host ("Tamanho: {0:N2} MB" -f $size) -ForegroundColor Cyan
    Write-Host ""
    Write-Host "INSTRUCOES:" -ForegroundColor Yellow
    Write-Host "1. Extraia o arquivo ZIP" -ForegroundColor White
    Write-Host "2. Clique com botao direito em INSTALAR.bat" -ForegroundColor White
    Write-Host "3. Selecione 'Executar como administrador'" -ForegroundColor White
    Write-Host "4. Aguarde a instalacao completa" -ForegroundColor White
    Write-Host ""
    Write-Host "NOTA: Para instalador EXE profissional, instale o Inno Setup:" -ForegroundColor Yellow
    Write-Host "https://jrsoftware.org/isdl.php" -ForegroundColor Cyan
    Write-Host "Depois execute este script novamente." -ForegroundColor Yellow
    Write-Host ""
}
