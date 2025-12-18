; Script NSIS para MercadoFlow Desktop
; Download NSIS: https://nsis.sourceforge.io/Download

!define APP_NAME "MercadoFlow Desktop Collector"
!define APP_VERSION "1.0.0"
!define COMPANY_NAME "MercadoFlow"
!define APP_EXE "MercadoFlow.Desktop.exe"
!define INSTALL_DIR "$PROGRAMFILES64\MercadoFlow"

; Configurações gerais
Name "${APP_NAME}"
OutFile "..\installer-output\MercadoFlow-Setup-v${APP_VERSION}.exe"
InstallDir "${INSTALL_DIR}"
RequestExecutionLevel admin

; Interface moderna
!include "MUI2.nsh"

; Páginas do instalador
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\LICENSE.txt"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; Páginas do desinstalador
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Linguagens
!insertmacro MUI_LANGUAGE "PortugueseBR"
!insertmacro MUI_LANGUAGE "English"

; Informações da versão
VIProductVersion "${APP_VERSION}.0"
VIAddVersionKey "ProductName" "${APP_NAME}"
VIAddVersionKey "CompanyName" "${COMPANY_NAME}"
VIAddVersionKey "FileVersion" "${APP_VERSION}"
VIAddVersionKey "FileDescription" "Instalador do ${APP_NAME}"
VIAddVersionKey "LegalCopyright" "Copyright © 2024 ${COMPANY_NAME}"

; Seção de instalação
Section "Instalar" SecInstall
  SetOutPath "$INSTDIR"

  ; Copiar todos os arquivos
  File /r "..\publish\*.*"

  ; Criar pastas de dados
  CreateDirectory "$INSTDIR\Data"
  CreateDirectory "$INSTDIR\Logs"
  CreateDirectory "$INSTDIR\Uploads"

  ; Dar permissões de escrita
  AccessControl::GrantOnFile "$INSTDIR\Data" "(BU)" "FullAccess"
  AccessControl::GrantOnFile "$INSTDIR\Logs" "(BU)" "FullAccess"
  AccessControl::GrantOnFile "$INSTDIR\Uploads" "(BU)" "FullAccess"

  ; Criar atalhos
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\Desinstalar.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}"

  ; Registrar desinstalador
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; Adicionar ao Painel de Controle
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "DisplayIcon" "$INSTDIR\${APP_EXE}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "Publisher" "${COMPANY_NAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "DisplayVersion" "${APP_VERSION}"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "NoRepair" 1

SectionEnd

; Seção de desinstalação
Section "Uninstall"
  ; Remover arquivos
  Delete "$INSTDIR\*.*"
  RMDir /r "$INSTDIR"

  ; Remover atalhos
  Delete "$SMPROGRAMS\${APP_NAME}\*.*"
  RMDir "$SMPROGRAMS\${APP_NAME}"
  Delete "$DESKTOP\${APP_NAME}.lnk"

  ; Remover registro
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}"

SectionEnd

; Função de inicialização
Function .onInit
  ; Verificar se já está instalado
  ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "UninstallString"
  StrCmp $0 "" done

  MessageBox MB_YESNO|MB_ICONQUESTION "${APP_NAME} já está instalado. Deseja desinstalá-lo primeiro?" IDYES uninst
  Abort

uninst:
  ExecWait '$0 _?=$INSTDIR'

done:
FunctionEnd
