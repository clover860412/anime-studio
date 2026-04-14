; 摸鱼动漫工作室 NSIS 安装脚本
; 自动检测并安装 WebView2 运行时

!include "MUI2.nsh"
!include "WinVer.nsh"
!include "LogicLib.nsh"

; === 基本信息 ===
!define APPNAME "摸鱼动漫工作室"
!define COMPANYNAME "摸鱼工作室"
!define DESCRIPTION "小说转视频分镜工具"
!define VERSIONMAJOR 0
!define VERSIONMINOR 1
!define VERSIONBUILD 0
!define INSTALLSIZE 22000

; === 安装程序属性 ===
Name "${APPNAME}"
OutFile "摸鱼动漫工作室-安装版.exe"
InstallDir "$PROGRAMFILES64\${APPNAME}"
InstallDirRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "InstallLocation"
RequestExecutionLevel admin

; === 界面设置 ===
!define MUI_ABORTWARNING
!define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"
!define MUI_UNICON "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall.ico"

; === 页面 ===
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "license.txt"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "SimpChinese"

; === 安装节 ===
Section "install"
    SetOutPath $INSTDIR
    
    ; 复制主程序和依赖
    File "动漫工作室.exe"
    File "WebView2Loader.dll"
    
    ; 写入注册表（卸载信息）
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayName" "${APPNAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "UninstallString" "$\"$INSTDIR\uninstall.exe$\""
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "QuietUninstallString" "$\"$INSTDIR\uninstall.exe$\" /S"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "InstallLocation" "$\"$INSTDIR$\""
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayIcon" "$\"$INSTDIR\动漫工作室.exe$\""
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "Publisher" "${COMPANYNAME}"
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "VersionMajor" ${VERSIONMAJOR}
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "VersionMinor" ${VERSIONMINOR}
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "NoModify" 1
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "NoRepair" 1
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "EstimatedSize" ${INSTALLSIZE}
    
    ; 创建卸载程序
    WriteUninstaller "uninstall.exe"
    
    ; 创建开始菜单快捷方式
    CreateDirectory "$SMPROGRAMS\${APPNAME}"
    CreateShortCut "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "$INSTDIR\动漫工作室.exe" "" "$INSTDIR\动漫工作室.exe" 0
    CreateShortCut "$SMPROGRAMS\${APPNAME}\卸载 ${APPNAME}.lnk" "$INSTDIR\uninstall.exe" "" "$INSTDIR\uninstall.exe" 0
    
    ; 创建桌面快捷方式
    CreateShortCut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\动漫工作室.exe" "" "$INSTDIR\动漫工作室.exe" 0
    
    ; === 检测并安装 WebView2 ===
    Call CheckWebView2
SectionEnd

; === 检查 WebView2 是否已安装 ===
Function CheckWebView2
    ; 检查注册表中的 WebView2 版本
    ReadRegStr $0 HKLM "SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
    ${If} $0 != ""
        ; WebView2 已安装，版本: $0
        DetailPrint "检测到 WebView2 运行时 $0，已安装"
    ${Else}
        ; 检查旧版 Edge WebView
        ReadRegStr $0 HKLM "SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
        ${If} $0 == ""
            DetailPrint "未检测到 WebView2，正在下载安装程序..."
            ; 下载 WebView2 安装程序
            NSISdl::download "https://go.microsoft.com/fwlink/p/?LinkId=2124703" "$TEMP\MicrosoftEdgeWebview2Setup.exe"
            DetailPrint "下载完成，正在安装..."
            ExecWait '"$TEMP\MicrosoftEdgeWebview2Setup.exe" /silent /install'
            DetailPrint "WebView2 安装完成"
            Delete "$TEMP\MicrosoftEdgeWebview2Setup.exe"
        ${EndIf}
    ${EndIf}
FunctionEnd

; === 卸载节 ===
Section "uninstall"
    ; 卸载主程序
    Delete "$INSTDIR\动漫工作室.exe"
    Delete "$INSTDIR\WebView2Loader.dll"
    Delete "$INSTDIR\uninstall.exe"
    RMDir "$INSTDIR"
    
    ; 卸载注册表信息
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}"
    
    ; 删除快捷方式
    Delete "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk"
    Delete "$SMPROGRAMS\${APPNAME}\卸载 ${APPNAME}.lnk"
    RMDir "$SMPROGRAMS\${APPNAME}"
    Delete "$DESKTOP\${APPNAME}.lnk"
SectionEnd
