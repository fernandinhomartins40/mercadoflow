; Script Inno Setup para MercadoFlow Desktop
; Download Inno Setup: https://jrsoftware.org/isdl.php

#define MyAppName "MercadoFlow Desktop Collector"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "MercadoFlow"
#define MyAppURL "https://mercadoflow.com"
#define MyAppExeName "MercadoFlow.Desktop.exe"

[Setup]
; Informações básicas
AppId={{A1B2C3D4-E5F6-4A5B-8C9D-0E1F2A3B4C5D}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\MercadoFlow
DefaultGroupName=MercadoFlow
AllowNoIcons=yes
LicenseFile=..\LICENSE.txt
OutputDir=..\installer-output
OutputBaseFilename=MercadoFlow-Desktop-Setup-v{#MyAppVersion}
SetupIconFile=mercadoflow-icon.ico
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=admin

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
Name: "quicklaunchicon"; Description: "Criar ícone na Barra de Tarefas"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "..\publish\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\publish\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; Arquivos de configuração
Source: "..\publish\appsettings.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\publish\NLog.config"; DestDir: "{app}"; Flags: ignoreversion

[Dirs]
Name: "{app}\Data"; Permissions: users-full
Name: "{app}\Logs"; Permissions: users-full
Name: "{app}\Uploads"; Permissions: users-full

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Desinstalar {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon
Name: "{userappdata}\Microsoft\Internet Explorer\Quick Launch\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: quicklaunchicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Executar {#MyAppName}"; Flags: nowait postinstall skipifsilent

[Code]
function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
begin
  Result := True;

  // Verificar se .NET 8 está instalado
  if not RegKeyExists(HKLM, 'SOFTWARE\dotnet\Setup\InstalledVersions\x64\sharedfx\Microsoft.WindowsDesktop.App\8.0.0') then
  begin
    if MsgBox('.NET 8 Desktop Runtime não foi encontrado. Deseja baixá-lo agora?' + #13#10 + #13#10 +
              'O instalador será aberto no navegador.', mbConfirmation, MB_YESNO) = IDYES then
    begin
      ShellExec('', 'https://dotnet.microsoft.com/download/dotnet/8.0', '', '', SW_SHOW, ewNoWait, ResultCode);
      Result := False;
      MsgBox('Por favor, instale o .NET 8 Desktop Runtime e execute este instalador novamente.', mbInformation, MB_OK);
    end
    else
    begin
      Result := False;
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    // Criar arquivo de configuração inicial se não existir
    if not FileExists(ExpandConstant('{app}\Data\mercadoflow.db')) then
    begin
      CreateDir(ExpandConstant('{app}\Data'));
    end;
  end;
end;

[UninstallDelete]
Type: filesandordirs; Name: "{app}\Logs"
Type: filesandordirs; Name: "{app}\Uploads"
