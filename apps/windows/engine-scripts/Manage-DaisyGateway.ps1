<#
.SYNOPSIS
    Installs, starts, stops, or removes the bundled Daisy gateway service.

.DESCRIPTION
    Ships inside the engine folder of the Daisy Assistant installer and is
    invoked hidden by the Inno Setup installer/uninstaller and, as a self-heal,
    by the tray app. It drives the gateway's own CLI (node.exe dist\index.js
    gateway <verb>) so the scheduled task carries the same tested settings the
    CLI always writes (ONLOGON, keep running on battery, single instance), and
    only falls back to schtasks/taskkill when the CLI cannot run.

    Runs under Windows PowerShell 5.1 (.NET Framework): do not use
    ProcessStartInfo.ArgumentList / .Environment here.

    Actions
      install    Register the "DaisyClaw Gateway" scheduled task pointing at
                 THIS engine folder, start it, and wait until it answers.
                 Idempotent (uses --force), so it also repairs a broken task
                 and repoints an upgraded install.
      start      Start the task and wait for health.
      stop       Stop the gateway (CLI stop, then schtasks /End, then kill any
                 node.exe that was launched from this engine folder).
      uninstall  Stop, then delete the scheduled task and its launcher scripts.

    Exit codes: 0 ok, 2 CLI command failed, 3 installed but not healthy in
    time, 4 engine files missing.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('install', 'start', 'stop', 'uninstall')]
    [string]$Action,

    [string]$EngineRoot = $PSScriptRoot,

    # 0 = read gateway.port from %USERPROFILE%\.daisyclaw\daisyclaw.json (default 18789).
    [int]$Port = 0,

    # Scheduled task name. Only override for isolated testing; the tray app
    # and the gateway CLI both default to "DaisyClaw Gateway".
    [string]$TaskName = 'DaisyClaw Gateway',

    # Gateway state directory (config, sessions, task scripts). Default is the
    # CLI's own %USERPROFILE%\.daisyclaw. Only override for isolated testing;
    # the value is baked into the scheduled task's environment by the CLI.
    [string]$StateDir,

    # First start on a fresh machine also builds the model catalog and seeds
    # the workspace, so allow well over a minute before declaring failure.
    [int]$HealthTimeoutSeconds = 150,

    [string]$LogPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:NodeExe = Join-Path $EngineRoot 'node.exe'
$script:EntryJs = Join-Path $EngineRoot 'dist\index.js'
$script:StateDir = if ($StateDir) { $StateDir } else { Join-Path $env:USERPROFILE '.daisyclaw' }

if (-not $LogPath) {
    $logDir = Join-Path $env:LOCALAPPDATA 'DaisyAssistant\logs'
    $LogPath = Join-Path $logDir 'gateway-setup.log'
}

function Write-Log {
    param([string]$Message)
    $line = "[{0}] [{1}] {2}" -f (Get-Date -Format 'o'), $Action, $Message
    try {
        $dir = Split-Path -Parent $LogPath
        if ($dir -and -not (Test-Path -LiteralPath $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
        Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
    } catch {
        # Logging must never fail the action.
    }
    Write-Host $line
}

function Resolve-GatewayPort {
    if ($Port -gt 0) { return $Port }
    $configPath = Join-Path $script:StateDir 'daisyclaw.json'
    try {
        if (Test-Path -LiteralPath $configPath) {
            # Strip // and /* */ comments; the config may be JSONC.
            $raw = Get-Content -LiteralPath $configPath -Raw
            $raw = [regex]::Replace($raw, '(?m)^\s*//.*$', '')
            $raw = [regex]::Replace($raw, '/\*[\s\S]*?\*/', '')
            $cfg = $raw | ConvertFrom-Json
            if ($cfg.gateway -and $cfg.gateway.port) {
                $p = [int]$cfg.gateway.port
                if ($p -gt 0 -and $p -lt 65536) { return $p }
            }
        }
    } catch {
        Write-Log "Could not read gateway.port from config ($($_.Exception.Message)); using 18789."
    }
    return 18789
}

function ConvertTo-CommandLineArgument {
    # Quote one argument for CreateProcess (msvcrt rules); used because
    # .NET Framework's ProcessStartInfo only accepts a single Arguments string.
    param([string]$Value)
    if ($Value -notmatch '[\s"]') { return $Value }
    $escaped = $Value -replace '(\\*)"', '$1$1\"'
    $escaped = $escaped -replace '(\\+)$', '$1$1'
    return '"' + $escaped + '"'
}

function Invoke-GatewayCli {
    param(
        [string[]]$CliArguments,
        [int]$TimeoutSeconds = 120
    )
    if (-not (Test-Path -LiteralPath $script:NodeExe) -or -not (Test-Path -LiteralPath $script:EntryJs)) {
        Write-Log "Engine files missing: $($script:NodeExe) / $($script:EntryJs)"
        return @{ ExitCode = 4; Output = ''; TimedOut = $false }
    }

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $script:NodeExe
    $psi.WorkingDirectory = $EngineRoot
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $allArgs = @($script:EntryJs) + $CliArguments
    $psi.Arguments = ($allArgs | ForEach-Object { ConvertTo-CommandLineArgument $_ }) -join ' '

    # The scheduled task must launch through the hidden VBS launcher so no
    # console window appears at logon; the CLI honors this env at install time.
    $psi.EnvironmentVariables['DAISYCLAW_WINDOWS_TASK_HIDDEN_LAUNCHER'] = '1'
    if ($TaskName -ne 'DaisyClaw Gateway') {
        $psi.EnvironmentVariables['DAISYCLAW_WINDOWS_TASK_NAME'] = $TaskName
    } elseif ($psi.EnvironmentVariables.ContainsKey('DAISYCLAW_WINDOWS_TASK_NAME')) {
        $psi.EnvironmentVariables.Remove('DAISYCLAW_WINDOWS_TASK_NAME')
    }
    # Never inherit a dev shell's profile/state overrides into the service.
    foreach ($k in @('DAISYCLAW_PROFILE', 'DAISYCLAW_STATE_DIR', 'DAISYCLAW_CONFIG_PATH')) {
        if ($psi.EnvironmentVariables.ContainsKey($k)) { $psi.EnvironmentVariables.Remove($k) }
    }
    if ($StateDir) {
        # Isolated test install: the CLI copies this into the task environment,
        # so the task-launched gateway uses the same isolated state directory.
        $psi.EnvironmentVariables['DAISYCLAW_STATE_DIR'] = $StateDir
    }

    Write-Log "Running: node.exe dist\index.js $($CliArguments -join ' ')"
    $proc = [System.Diagnostics.Process]::Start($psi)
    $stdoutTask = $proc.StandardOutput.ReadToEndAsync()
    $stderrTask = $proc.StandardError.ReadToEndAsync()
    $timedOut = -not $proc.WaitForExit($TimeoutSeconds * 1000)
    if ($timedOut) {
        Write-Log "CLI timed out after ${TimeoutSeconds}s; killing."
        try { $proc.Kill() } catch {}
        $proc.WaitForExit(5000) | Out-Null
    }
    $output = ($stdoutTask.Result + "`n" + $stderrTask.Result).Trim()
    if ($output) {
        foreach ($line in ($output -split "`r?`n")) {
            if ($line.Trim()) { Write-Log "  | $line" }
        }
    }
    $code = if ($timedOut) { 124 } else { $proc.ExitCode }
    Write-Log "CLI exit code: $code"
    return @{ ExitCode = $code; Output = $output; TimedOut = $timedOut }
}

function Test-GatewayHealthy {
    param([int]$GatewayPort)
    try {
        $req = [System.Net.WebRequest]::Create("http://127.0.0.1:$GatewayPort/")
        $req.Timeout = 3000
        $req.Method = 'GET'
        $resp = $req.GetResponse()
        $resp.Close()
        return $true
    } catch [System.Net.WebException] {
        # Any HTTP answer (401/403/404...) means the gateway is up.
        if ($_.Exception.Response) { return $true }
        return $false
    } catch {
        return $false
    }
}

function Wait-GatewayHealthy {
    param([int]$GatewayPort, [int]$TimeoutSeconds)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-GatewayHealthy -GatewayPort $GatewayPort) { return $true }
        Start-Sleep -Seconds 2
    }
    return $false
}

function Invoke-Schtasks {
    param([string[]]$SchtasksArguments)
    $schtasks = Join-Path $env:SystemRoot 'System32\schtasks.exe'
    try {
        & $schtasks @SchtasksArguments 2>&1 | Out-Null
        $code = $LASTEXITCODE
        Write-Log "schtasks $($SchtasksArguments -join ' ') -> $code"
        return $code
    } catch {
        Write-Log "schtasks failed to start: $($_.Exception.Message)"
        return 1
    }
}

function Get-EngineProcesses {
    # node.exe processes launched from THIS engine folder only, so a
    # developer's own gateway or unrelated Node apps are never touched.
    $engineMarker = (Resolve-Path -LiteralPath $EngineRoot).Path.TrimEnd('\') + '\'
    try {
        return @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
            Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($engineMarker, [StringComparison]::OrdinalIgnoreCase) -ge 0 })
    } catch {
        Write-Log "Process enumeration failed: $($_.Exception.Message)"
        return @()
    }
}

function Stop-EngineProcesses {
    try {
        $procs = Get-EngineProcesses
        foreach ($p in $procs) {
            Write-Log "Killing engine node.exe pid $($p.ProcessId)"
            & (Join-Path $env:SystemRoot 'System32\taskkill.exe') /F /T /PID $p.ProcessId 2>&1 | Out-Null
        }
    } catch {
        Write-Log "Process sweep failed: $($_.Exception.Message)"
    }
}

function Invoke-StopAction {
    $r = Invoke-GatewayCli -CliArguments @('gateway', 'stop') -TimeoutSeconds 60
    if ($r.ExitCode -ne 0) {
        Invoke-Schtasks -SchtasksArguments @('/End', '/TN', $TaskName) | Out-Null
    }
    Stop-EngineProcesses
    $gatewayPort = Resolve-GatewayPort
    $deadline = (Get-Date).AddSeconds(20)
    while ((Get-Date) -lt $deadline -and (Test-GatewayHealthy -GatewayPort $gatewayPort)) {
        Start-Sleep -Seconds 1
    }
    return 0
}

Write-Log "Engine root: $EngineRoot; task: $TaskName; state: $($script:StateDir)"

switch ($Action) {
    'install' {
        $cliArgs = @('gateway', 'install', '--force')
        if ($Port -gt 0) { $cliArgs += @('--port', "$Port") }
        $r = Invoke-GatewayCli -CliArguments $cliArgs -TimeoutSeconds 180
        if ($r.ExitCode -eq 4) { exit 4 }
        if ($r.ExitCode -ne 0) {
            Write-Log 'gateway install failed.'
            exit 2
        }
        $gatewayPort = Resolve-GatewayPort
        Write-Log "Waiting up to ${HealthTimeoutSeconds}s for the gateway on port $gatewayPort..."
        if (Wait-GatewayHealthy -GatewayPort $gatewayPort -TimeoutSeconds $HealthTimeoutSeconds) {
            Write-Log 'Gateway is healthy.'
            exit 0
        }
        # Nothing answered yet. If an engine gateway process is alive it is
        # just slow (first start): keep waiting rather than launching a second
        # instance. Only re-run the task when no engine process exists.
        if ((Get-EngineProcesses).Count -gt 0) {
            Write-Log 'Gateway process is running but not answering yet; waiting longer.'
            if (Wait-GatewayHealthy -GatewayPort $gatewayPort -TimeoutSeconds 90) {
                Write-Log 'Gateway is healthy.'
                exit 0
            }
        } else {
            Write-Log 'No gateway process found; re-running the task once.'
            Invoke-Schtasks -SchtasksArguments @('/Run', '/TN', $TaskName) | Out-Null
            if (Wait-GatewayHealthy -GatewayPort $gatewayPort -TimeoutSeconds 90) {
                Write-Log 'Gateway is healthy after re-run.'
                exit 0
            }
        }
        Write-Log 'Gateway installed but did not become healthy.'
        exit 3
    }
    'start' {
        $r = Invoke-GatewayCli -CliArguments @('gateway', 'start') -TimeoutSeconds 60
        if ($r.ExitCode -ne 0) {
            Invoke-Schtasks -SchtasksArguments @('/Run', '/TN', $TaskName) | Out-Null
        }
        $gatewayPort = Resolve-GatewayPort
        if (Wait-GatewayHealthy -GatewayPort $gatewayPort -TimeoutSeconds $HealthTimeoutSeconds) { exit 0 }
        exit 3
    }
    'stop' {
        exit (Invoke-StopAction)
    }
    'uninstall' {
        Invoke-StopAction | Out-Null
        $r = Invoke-GatewayCli -CliArguments @('gateway', 'uninstall') -TimeoutSeconds 60
        if ($r.ExitCode -ne 0) {
            Invoke-Schtasks -SchtasksArguments @('/Delete', '/F', '/TN', $TaskName) | Out-Null
            foreach ($name in @('gateway.cmd', 'gateway.vbs')) {
                $p = Join-Path $script:StateDir $name
                if (Test-Path -LiteralPath $p) {
                    Remove-Item -LiteralPath $p -Force -ErrorAction SilentlyContinue
                    Write-Log "Removed $p"
                }
            }
        }
        Write-Log 'Gateway service removed.'
        exit 0
    }
}
