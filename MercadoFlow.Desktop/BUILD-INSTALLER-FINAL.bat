@echo off
title MercadoFlow - Criando Instalador Profissional
color 0B

echo ========================================
echo   Criando Instalador MSI Profissional
echo ========================================
echo.

cd /d "%~dp0"

REM Verificar se dotnet esta instalado
dotnet --version >nul 2>&1
if errorlevel 1 (
    echo ERRO: .NET SDK nao encontrado!
    pause
    exit /b 1
)

echo [1/3] Publicando aplicacao...
dotnet publish src\MercadoFlow.Desktop.csproj -c Release -r win-x64 --self-contained true -o publish-installer

echo.
echo [2/3] Baixando WiX Toolset...
if not exist "wix" mkdir wix
cd wix

REM Baixar WiX binaries
powershell -Command "Invoke-WebRequest -Uri 'https://github.com/wixtoolset/wix3/releases/download/wix3141rtm/wix314-binaries.zip' -OutFile 'wix.zip'"
powershell -Command "Expand-Archive -Path 'wix.zip' -DestinationPath '.' -Force"
cd ..

echo.
echo [3/3] Criando MSI com WiX...

REM Criar arquivo WXS
(
echo ^<?xml version="1.0" encoding="UTF-8"?^>
echo ^<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi"^>
echo   ^<Product Id="*" Name="MercadoFlow Desktop" Language="1046" Version="1.0.0" Manufacturer="MercadoFlow" UpgradeCode="A1B2C3D4-E5F6-4A5B-8C9D-0E1F2A3B4C5D"^>
echo     ^<Package InstallerVersion="200" Compressed="yes" InstallScope="perMachine" /^>
echo     ^<MajorUpgrade DowngradeErrorMessage="Uma versao mais recente ja esta instalada." /^>
echo     ^<MediaTemplate EmbedCab="yes" /^>
echo     ^<Directory Id="TARGETDIR" Name="SourceDir"^>
echo       ^<Directory Id="ProgramFiles64Folder"^>
echo         ^<Directory Id="INSTALLFOLDER" Name="MercadoFlow" /^>
echo       ^</Directory^>
echo       ^<Directory Id="ProgramMenuFolder"^>
echo         ^<Directory Id="ApplicationProgramsFolder" Name="MercadoFlow"/^>
echo       ^</Directory^>
echo       ^<Directory Id="DesktopFolder" Name="Desktop" /^>
echo     ^</Directory^>
echo     ^<DirectoryRef Id="INSTALLFOLDER"^>
echo       ^<Component Id="MainExecutable" Guid="B1C2D3E4-F5A6-7B8C-9D0E-1F2A3B4C5D6E"^>
echo         ^<File Id="AppExe" Source="publish-installer\MercadoFlow.Desktop.exe" KeyPath="yes" /^>
echo       ^</Component^>
echo     ^</DirectoryRef^>
echo     ^<DirectoryRef Id="ApplicationProgramsFolder"^>
echo       ^<Component Id="ApplicationShortcut" Guid="C1D2E3F4-A5B6-8C9D-0E1F-2A3B4C5D6E7F"^>
echo         ^<Shortcut Id="AppStartMenuShortcut" Name="MercadoFlow Desktop" Target="[INSTALLFOLDER]MercadoFlow.Desktop.exe" WorkingDirectory="INSTALLFOLDER"/^>
echo         ^<RemoveFolder Id="ApplicationProgramsFolder" On="uninstall"/^>
echo         ^<RegistryValue Root="HKCU" Key="Software\MercadoFlow" Name="installed" Type="integer" Value="1" KeyPath="yes"/^>
echo       ^</Component^>
echo     ^</DirectoryRef^>
echo     ^<DirectoryRef Id="DesktopFolder"^>
echo       ^<Component Id="DesktopShortcut" Guid="D1E2F3A4-B5C6-9D0E-1F2A-3B4C5D6E7F8A"^>
echo         ^<Shortcut Id="AppDesktopShortcut" Name="MercadoFlow Desktop" Target="[INSTALLFOLDER]MercadoFlow.Desktop.exe" WorkingDirectory="INSTALLFOLDER"/^>
echo         ^<RegistryValue Root="HKCU" Key="Software\MercadoFlow" Name="desktop" Type="integer" Value="1" KeyPath="yes"/^>
echo       ^</Component^>
echo     ^</DirectoryRef^>
echo     ^<Feature Id="ProductFeature" Title="MercadoFlow Desktop" Level="1"^>
echo       ^<ComponentRef Id="MainExecutable" /^>
echo       ^<ComponentRef Id="ApplicationShortcut" /^>
echo       ^<ComponentRef Id="DesktopShortcut" /^>
echo     ^</Feature^>
echo   ^</Product^>
echo ^</Wix^>
) > installer.wxs

REM Compilar com WiX
wix\candle.exe installer.wxs -out installer.wixobj
wix\light.exe installer.wixobj -out MercadoFlow-Desktop-Setup.msi -ext WixUIExtension

if exist "MercadoFlow-Desktop-Setup.msi" (
    echo.
    echo ========================================
    echo   MSI CRIADO COM SUCESSO!
    echo ========================================
    echo.
    echo Arquivo: MercadoFlow-Desktop-Setup.msi
    for %%A in ("MercadoFlow-Desktop-Setup.msi") do echo Tamanho: %%~zA bytes
    echo.
    echo Execute o MSI para instalar!
    echo.
) else (
    echo.
    echo ERRO: Falha ao criar MSI
    echo Usando instalador BAT alternativo...
    echo.
)

pause
