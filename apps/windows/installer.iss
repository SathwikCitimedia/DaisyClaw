; Daisy Assistant Inno Setup Script (WinUI version, based on DaisyClaw Companion)
; Pass /DDevBuild=1 to produce a side-by-side dev installer.
#ifdef DevBuild
  #define MyAppName "Daisy Assistant (Dev)"
  #define MyAppAumid "DaisyClaw.DaisyAssistant.Dev"
  #define MyAppId "{{5E673CE8-678F-42BB-AADB-14232CE7AA9E}"
  #define MyInstallDir "DaisyAssistant-Dev"
  #define MyMutex "DaisyAssistant-Dev"
  #define MyAutoStartName "DaisyAssistant-Dev"
  #define MyStartupTaskName "Daisy Assistant (Dev)"
  #define MyDistroName "DaisyClawGateway-Dev"
  #define MyProtocol "daisy-dev"
  #define MyOutputSuffix "-Dev"
#else
  #define MyAppName "Daisy Assistant"
  #define MyAppAumid "DaisyClaw.DaisyAssistant"
  #define MyAppId "{{A5B596FF-EAA8-4FDD-BE3A-36180A2A036E}"
  #define MyInstallDir "DaisyAssistant"
  #define MyMutex "DaisyAssistant"
  #define MyAutoStartName "DaisyAssistant"
  #define MyStartupTaskName "Daisy Assistant"
  #define MyDistroName "DaisyClawGateway"
  #define MyProtocol "daisy"
  #define MyOutputSuffix ""
#endif
#define MyAppPublisher "Citimedia"
#define MyAppURL "https://github.com/daisyclaw/daisyclaw"
#define MyAppExeName "DaisyClaw.Tray.WinUI.exe"

; MyAppArch should be passed via /DMyAppArch=x64 or /DMyAppArch=arm64
#ifndef MyAppArch
  #define MyAppArch "x64"
#endif

#ifndef MyCompression
  #define MyCompression "lzma"
#endif

#ifndef MySolidCompression
  #define MySolidCompression "yes"
#endif

[Setup]
; Inno requires "{{" to emit a literal opening brace in AppId.
; Do not add a second closing brace here; that creates a malformed uninstall registry key.
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL=https://github.com/daisyclaw/daisyclaw/issues
AppUpdatesURL=https://github.com/daisyclaw/daisyclaw/releases
DefaultDirName={localappdata}\{#MyInstallDir}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputBaseFilename=DaisyAssistant{#MyOutputSuffix}-Setup-{#MyAppArch}
Compression={#MyCompression}
SolidCompression={#MySolidCompression}
WizardStyle=modern
PrivilegesRequired=lowest
SetupIconFile=src\DaisyClaw.Tray.WinUI\Assets\daisyclaw.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
; Round 2 (Scott #5): block install/uninstall while the tray is running.
; Mutex name matches AppIdentity.MutexBaseName for this build variant.
; Tray and Inno run in the same user session, so no Global\ prefix is needed.
AppMutex={#MyMutex}
#if MyAppArch == "arm64"
ArchitecturesInstallIn64BitMode=arm64
ArchitecturesAllowed=arm64
#else
ArchitecturesInstallIn64BitMode=x64
ArchitecturesAllowed=x64
#endif

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

; publish folder should be passed via /Dpublish=publish-x64 or /Dpublish=publish-arm64
#ifndef publish
  #define publish "publish"
#endif

#if !FileExists(publish + "\DaisyClaw.Tray.WinUI.exe")
  #error Tray payload missing. Publish DaisyClaw.Tray.WinUI before compiling the installer.
#endif

#if FileExists(publish + "\SetupEngine\DaisyClaw.SetupEngine.UI.exe")
  #error SetupEngine.UI.exe should not be shipped. Setup UI is hosted by DaisyClaw.Tray.WinUI.exe.
#endif

; engine folder (private node.exe + built gateway + production node_modules),
; produced by scripts\Build-EngineBundle.ps1. Pass via /Dengine=<path>.
#ifndef engine
  #define engine "engine-" + MyAppArch
#endif

#if !FileExists(engine + "\node.exe")
  #error Engine payload missing (node.exe). Run scripts\Build-EngineBundle.ps1 before compiling the installer.
#endif
#if !FileExists(engine + "\dist\index.js")
  #error Engine payload missing (dist\index.js). Run scripts\Build-EngineBundle.ps1 before compiling the installer.
#endif
#if !FileExists(engine + "\Manage-DaisyGateway.ps1")
  #error Engine payload missing (Manage-DaisyGateway.ps1). Run scripts\Build-EngineBundle.ps1 before compiling the installer.
#endif

; vcRedist should point at the architecture-matching Visual C++ Runtime
; redistributable in CI release builds.
#ifndef vcRedist
  #define vcRedist ""
#endif

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "startupicon"; Description: "Start {#MyAppName} when Windows starts"; GroupDescription: "Startup:"; Flags: unchecked

[Files]
; WinUI Tray app - include all files (WinUI needs DLLs, not single-file)
Source: "{#publish}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs
; Self-contained gateway engine. Runs as the per-user scheduled task
; "DaisyClaw Gateway", registered by [Code] right after the files land.
Source: "{#engine}\*"; DestDir: "{app}\engine"; Flags: ignoreversion recursesubdirs createallsubdirs
; WSL gateway uninstall helper copied to {tmp} by [Code] during uninstall.
Source: "scripts\Uninstall-LocalGateway.ps1"; DestDir: "{app}"; Flags: ignoreversion
#if vcRedist != ""
Source: "{#vcRedist}"; DestDir: "{tmp}"; DestName: "vc_redist.exe"; Flags: deleteafterinstall; AfterInstall: InstallVCRuntime
#endif

[Registry]
Root: HKCU; Subkey: "Software\Classes\{#MyProtocol}"; ValueType: string; ValueName: ""; ValueData: "URL:Daisy Protocol"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\{#MyProtocol}"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\{#MyProtocol}\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"",0"
Root: HKCU; Subkey: "Software\Classes\{#MyProtocol}\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"" ""%1"""

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; AppUserModelID: "{#MyAppAumid}"
Name: "{group}\Check for Updates"; Filename: "{app}\{#MyAppExeName}"; Parameters: "{#MyProtocol}://check-updates"; IconFilename: "{app}\{#MyAppExeName}"; AppUserModelID: "{#MyAppAumid}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon; AppUserModelID: "{#MyAppAumid}"
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: startupicon; AppUserModelID: "{#MyAppAumid}"

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent; Check: ShouldLaunchTray

[Code]
var
  VCRuntimeInstallSucceeded: Boolean;
  LocalGatewayCleanupChoiceInitialized: Boolean;
  LocalGatewayCleanupRequested: Boolean;
  LocalGatewayCleanupSucceeded: Boolean;
  UserDataRemovalRequested: Boolean;

// ---------------------------------------------------------------------------
// Bundled gateway engine ({app}\engine): the per-user "DaisyClaw Gateway"
// scheduled task is created/repaired by the engine's own CLI through
// Manage-DaisyGateway.ps1, so the task carries the same tested settings as a
// CLI install (ONLOGON, keep running on battery, hidden launcher, single
// instance). Every call is hidden and logged to {app}\gateway-setup.log.
// ---------------------------------------------------------------------------
function EngineScriptPath: string;
begin
  Result := ExpandConstant('{app}\engine\Manage-DaisyGateway.ps1');
end;

function RunEngineAction(const Action: string; var ResultCode: Integer): Boolean;
var
  Params: string;
begin
  if not FileExists(EngineScriptPath) then
  begin
    ResultCode := 4;
    Log('Engine script missing, skipping gateway ' + Action + ': ' + EngineScriptPath);
    Result := False;
    Exit;
  end;

  Params :=
    '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File ' + AddQuotes(EngineScriptPath) +
    ' -Action ' + Action +
    ' -EngineRoot ' + AddQuotes(ExpandConstant('{app}\engine')) +
    ' -LogPath ' + AddQuotes(ExpandConstant('{app}\gateway-setup.log'));

  Log('Gateway ' + Action + ': powershell ' + Params);
  Result :=
    Exec(
      ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
      Params,
      ExpandConstant('{app}\engine'),
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode);

  if Result then
    Log('Gateway ' + Action + ' exited with code ' + IntToStr(ResultCode) + '.')
  else
    Log('Failed to start gateway ' + Action + '. System error: ' + IntToStr(ResultCode) + '.');
end;

procedure StopGatewayBeforeUpgrade;
var
  ResultCode: Integer;
begin
  // Upgrade over an existing install: the running gateway holds engine files
  // open, so stop it before Inno replaces them. First installs have no engine
  // yet and skip silently.
  if FileExists(EngineScriptPath) then
  begin
    WizardForm.StatusLabel.Caption := 'Stopping the Daisy service...';
    RunEngineAction('stop', ResultCode);
  end;
end;

procedure InstallAndStartGateway;
var
  ResultCode: Integer;
  Started: Boolean;
begin
  WizardForm.StatusLabel.Caption := 'Starting Daisy...';
  Started := RunEngineAction('install', ResultCode);
  if Started and (ResultCode = 0) then
  begin
    Log('Gateway service installed and healthy.');
    Exit;
  end;

  // Exit 3 = the task is registered and the gateway is starting but has not
  // answered yet. First start on a fresh PC can take minutes (antivirus scans
  // the freshly written engine); the tray keeps waiting and opens the
  // dashboard as soon as it answers, so this is not an error for the user.
  if Started and (ResultCode = 3) then
  begin
    Log('Gateway service installed; still starting. The app will connect when it is ready.');
    Exit;
  end;

  // Non-fatal: the tray app repairs the service on every launch using the same
  // script, so the install still completes. Tell the user only when not silent.
  Log('Gateway service install did not complete cleanly (code ' + IntToStr(ResultCode) + '); the app will retry on launch.');
  if not WizardSilent() then
    MsgBox(
      'Daisy Assistant was installed, but its background service could not be started yet.' + #13#10#13#10 +
      'It will try again automatically when you open Daisy Assistant.' + #13#10 +
      'Details: ' + ExpandConstant('{app}\gateway-setup.log'),
      mbInformation,
      MB_OK);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssInstall then
    StopGatewayBeforeUpgrade
  else if CurStep = ssPostInstall then
    InstallAndStartGateway;
end;

#if vcRedist != ""
procedure InstallVCRuntime;
var
  ResultCode: Integer;
  Started: Boolean;
begin
  VCRuntimeInstallSucceeded := False;
  Log('Running bundled Visual C++ Runtime redistributable.');
  Started :=
    Exec(
      ExpandConstant('{tmp}\vc_redist.exe'),
      '/install /quiet /norestart',
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode);

  if not Started then
  begin
    Log('Failed to start Visual C++ Runtime redistributable. System error: ' + IntToStr(ResultCode) + '.');
    Exit;
  end;

  VCRuntimeInstallSucceeded := (ResultCode = 0) or (ResultCode = 3010) or (ResultCode = 1641);
  if VCRuntimeInstallSucceeded then
    Log('Visual C++ Runtime redistributable exited with success code ' + IntToStr(ResultCode) + '.')
  else
    Log('Visual C++ Runtime redistributable failed with exit code ' + IntToStr(ResultCode) + '.');
end;
#endif

function ShouldLaunchTray: Boolean;
begin
#if vcRedist != ""
  Result := VCRuntimeInstallSucceeded;
  if not Result then
    Log('Skipping post-install tray launch because Visual C++ Runtime installation did not succeed.');
#else
  Result := True;
#endif
end;

procedure EnsureLocalGatewayCleanupChoice;
begin
  if LocalGatewayCleanupChoiceInitialized then
    Exit;

  LocalGatewayCleanupChoiceInitialized := True;

  if UninstallSilent() then
  begin
    // Silent uninstall never deletes the user's conversations and settings.
    UserDataRemovalRequested := False;
    LocalGatewayCleanupRequested := False;
    Log('Silent uninstall: keeping user data.');
  end
  else
  begin
    UserDataRemovalRequested :=
      MsgBox(
        'Do you also want to delete your Daisy data?' + #13#10#13#10 +
        'This removes your conversations, memory, settings and API keys stored on this computer' + #13#10 +
        '(' + ExpandConstant('{%USERPROFILE}\.daisyclaw') + ' and ' + ExpandConstant('{userappdata}\{#MyInstallDir}') + ').' + #13#10#13#10 +
        'Choose No to keep them for a future reinstall.',
        mbConfirmation,
        MB_YESNO or MB_DEFBUTTON2) = IDYES;

    // The legacy WSL gateway only exists on developer machines that used the
    // fork's WSL flow; clean it up only together with the user's data.
    LocalGatewayCleanupRequested :=
      UserDataRemovalRequested and DirExists(ExpandConstant('{app}\wsl'));

    if UserDataRemovalRequested then
      Log('User chose to delete Daisy data.')
    else
      Log('User chose to keep Daisy data.');
  end;
end;

procedure RemoveGatewayService;
var
  ResultCode: Integer;
begin
  UninstallProgressForm.StatusLabel.Caption := 'Stopping the Daisy service...';
  RunEngineAction('uninstall', ResultCode);
end;

procedure DeleteUserData;
var
  Target: string;
begin
  if not UserDataRemovalRequested then
    Exit;

  Target := ExpandConstant('{%USERPROFILE}\.daisyclaw');
  if DirExists(Target) then
  begin
    if DelTree(Target, True, True, True) then
      Log('Deleted Daisy data at ' + Target)
    else
      Log('Could not fully delete ' + Target);
  end;

  Target := ExpandConstant('{userappdata}\{#MyInstallDir}');
  if DirExists(Target) then
  begin
    if DelTree(Target, True, True, True) then
      Log('Deleted app settings at ' + Target)
    else
      Log('Could not fully delete ' + Target);
  end;

  Target := ExpandConstant('{localappdata}\{#MyInstallDir}\logs');
  if DirExists(Target) then
    DelTree(Target, True, True, True);
end;

function RunLocalGatewayCleanupOnce(var ResultCode: Integer): Boolean;
var
  SourceScriptPath: string;
  TempScriptPath: string;
  Params: string;
begin
  SourceScriptPath := ExpandConstant('{app}\Uninstall-LocalGateway.ps1');
  TempScriptPath := ExpandConstant('{tmp}\Uninstall-LocalGateway.ps1');

  if not FileExists(SourceScriptPath) then
  begin
    ResultCode := 2;
    Log('Local gateway cleanup script is missing: ' + SourceScriptPath);
    Result := False;
    Exit;
  end;

  if FileExists(TempScriptPath) then
    DeleteFile(TempScriptPath);

  if not CopyFile(SourceScriptPath, TempScriptPath, False) then
  begin
    ResultCode := 3;
    Log('Failed to copy local gateway cleanup script to: ' + TempScriptPath);
    Result := False;
    Exit;
  end;

  Params :=
    '-NoProfile -ExecutionPolicy Bypass -File ' + AddQuotes(TempScriptPath) +
    ' -AppRoot ' + AddQuotes(ExpandConstant('{app}')) +
    ' -DataDirectoryName ' + AddQuotes('{#MyInstallDir}') +
    ' -AutoStartName ' + AddQuotes('{#MyAutoStartName}') +
    ' -StartupTaskName ' + AddQuotes('{#MyStartupTaskName}') +
    ' -DistroName ' + AddQuotes('{#MyDistroName}');

  Log('Running local gateway cleanup script from {tmp}.');
  Result :=
    Exec(
      ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
      Params,
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode);

  if Result then
    Log('Local gateway cleanup script exited with code ' + IntToStr(ResultCode) + '.')
  else
    Log('Failed to start local gateway cleanup script. System error: ' + IntToStr(ResultCode) + '.');
end;

procedure RunLocalGatewayCleanup;
var
  ResultCode: Integer;
  Retry: Boolean;
  Started: Boolean;
begin
  if not LocalGatewayCleanupRequested then
    Exit;

  LocalGatewayCleanupSucceeded := False;

  repeat
    Retry := False;
    UninstallProgressForm.StatusLabel.Caption := 'Removing local WSL gateway...';
    Started := RunLocalGatewayCleanupOnce(ResultCode);

    if Started and (ResultCode = 0) then
    begin
      LocalGatewayCleanupSucceeded := True;
      Log('Local gateway cleanup completed successfully.');
      Exit;
    end;

    if UninstallSilent() then
    begin
      Log('Local gateway cleanup failed during silent uninstall; continuing without deleting generated state.');
      Exit;
    end;

    Retry :=
      MsgBox(
        'Daisy Assistant could not remove the local WSL gateway.' + #13#10#13#10 +
        'Exit code: ' + IntToStr(ResultCode) + #13#10#13#10 +
        'Select Retry to try again, or Cancel to continue uninstalling Daisy Assistant and leave local gateway state on disk.',
        mbError,
        MB_RETRYCANCEL) = IDRETRY;
  until not Retry;

  Log('User continued uninstall after local gateway cleanup failed; generated state will be preserved.');
end;

procedure DeleteGeneratedAppState;
begin
  if not (LocalGatewayCleanupSucceeded or UserDataRemovalRequested) then
    Exit;

  if DelTree(ExpandConstant('{app}'), True, True, True) then
    Log('Deleted generated app state from {app}.')
  else
    Log('Generated app state in {app} could not be fully deleted; continuing uninstall.');
end;

procedure RemoveAppAutoStart;
var
  ResultCode: Integer;
  Started: Boolean;
begin
  if RegDeleteValue(
      HKCU,
      'SOFTWARE\Microsoft\Windows\CurrentVersion\Run',
      '{#MyAutoStartName}') then
    Log('Removed {#MyAutoStartName} autostart registry value.')
  else
    Log('{#MyAutoStartName} autostart registry value already absent.');

  Started :=
    Exec(
      ExpandConstant('{sys}\schtasks.exe'),
      '/Delete /TN ' + AddQuotes('{#MyStartupTaskName}') + ' /F',
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode);
  if Started and (ResultCode = 0) then
    Log('Removed {#MyStartupTaskName} startup task.')
  else
    Log('{#MyStartupTaskName} startup task already absent or unavailable.');
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then
  begin
    RemoveAppAutoStart;
    // Engine files are still on disk here, so the gateway's own CLI can stop
    // and unregister its scheduled task before Inno deletes {app}.
    RemoveGatewayService;
    EnsureLocalGatewayCleanupChoice;
    RunLocalGatewayCleanup;
  end
  else if CurUninstallStep = usPostUninstall then
  begin
    DeleteUserData;
    DeleteGeneratedAppState;
  end;
end;
