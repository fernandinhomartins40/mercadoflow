@echo off
title MercadoFlow Desktop - Instalador
color 0A

echo ========================================
echo   MercadoFlow Desktop - Instalador
echo ========================================
echo.

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERRO: Execute como Administrador!
    echo Clique com botao direito e selecione "Executar como administrador"
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
icacls "%INSTALL_DIR%\Data" /grant Users:(OI)(CI)F /T >nul
icacls "%INSTALL_DIR%\Logs" /grant Users:(OI)(CI)F /T >nul
icacls "%INSTALL_DIR%\Uploads" /grant Users:(OI)(CI)F /T >nul

echo [4/6] Criando atalhos...
powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%PUBLIC%\Desktop\MercadoFlow Desktop.lnk'); $Shortcut.TargetPath = '%INSTALL_DIR%\MercadoFlow.Desktop.exe'; $Shortcut.WorkingDirectory = '%INSTALL_DIR%'; $Shortcut.Save()"

powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%ProgramData%\Microsoft\Windows\Start Menu\Programs\MercadoFlow Desktop.lnk'); $Shortcut.TargetPath = '%INSTALL_DIR%\MercadoFlow.Desktop.exe'; $Shortcut.WorkingDirectory = '%INSTALL_DIR%'; $Shortcut.Save()"

echo [5/6] Registrando no Windows...
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\MercadoFlow" /v "DisplayName" /t REG_SZ /d "MercadoFlow Desktop Collector" /f >nul
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\MercadoFlow" /v "DisplayVersion" /t REG_SZ /d "1.0.0" /f >nul
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\MercadoFlow" /v "Publisher" /t REG_SZ /d "MercadoFlow" /f >nul
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\MercadoFlow" /v "InstallLocation" /t REG_SZ /d "%INSTALL_DIR%" /f >nul
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\MercadoFlow" /v "UninstallString" /t REG_SZ /d "%INSTALL_DIR%\uninstall.bat" /f >nul
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\MercadoFlow" /v "DisplayIcon" /t REG_SZ /d "%INSTALL_DIR%\MercadoFlow.Desktop.exe" /f >nul

echo [6/6] Criando desinstalador...
(
echo @echo off
echo title MercadoFlow Desktop - Desinstalador
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
) > "%INSTALL_DIR%\uninstall.bat"

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
echo Deseja executar agora? (S/N)
set /p "run="
if /i "%run%"=="S" start "" "%INSTALL_DIR%\MercadoFlow.Desktop.exe"
echo.
echo Pressione qualquer tecla para fechar...
pause >nul
