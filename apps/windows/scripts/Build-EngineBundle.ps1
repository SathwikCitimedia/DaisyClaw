<#
.SYNOPSIS
    Builds the self-contained Daisy gateway engine folder that ships inside the
    Daisy Assistant installer.

.DESCRIPTION
    Produces <OutputDir> with everything the gateway needs to run on a machine
    that has nothing installed:

      node.exe                    private Node runtime (copied from this machine)
      dist\                       built gateway + Control UI (consumer lockdown baked ON)
      node_modules\               production dependencies only
      package.json
      skills\                     bundled skills
      src\agents\templates\       production persona + heartbeat template
      docs\reference\templates\   workspace templates (AGENTS.md, SOUL.md, ...)
      Manage-DaisyGateway.ps1     service install/stop/uninstall helper
      engine-manifest.json        version / node / build stamp

    Steps: pnpm ui:build -> pnpm build (with DAISYCLAW_CONSUMER_LOCKDOWN_BAKED=1)
    -> pnpm deploy --prod (+ npm install --omit=dev, because pnpm deploy stops
    on an unused-patch error but still writes the package) -> assemble -> strip
    sourcemaps -> smoke test (node.exe dist\index.js --version with a throwaway
    HOME).

    NOTE: `pnpm build` leaves the repo's own dist\ with the lockdown baked on.
    Run `pnpm build` again afterwards if you need a dev dist.

.EXAMPLE
    .\scripts\Build-EngineBundle.ps1
    .\scripts\Build-EngineBundle.ps1 -SkipHostBuild -SkipUiBuild   # reuse current dist
#>
[CmdletBinding()]
param(
    [string]$OutputDir,
    [switch]$SkipUiBuild,
    [switch]$SkipHostBuild,
    [switch]$KeepSourceMaps,
    [string]$NodeExe,
    [string]$StageDir
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$windowsRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$repoRoot = Resolve-Path (Join-Path $windowsRoot '..\..')
if (-not $OutputDir) { $OutputDir = Join-Path $windowsRoot 'engine-x64' }
if (-not $StageDir) {
    $cacheRoot = if (Test-Path 'D:\build-cache') { 'D:\build-cache' } else { $env:TEMP }
    $StageDir = Join-Path $cacheRoot 'daisy-engine-stage'
}

function Write-Step { param([string]$m) Write-Host "`n=== $m ===" -ForegroundColor Cyan }
function Invoke-Checked {
    # NB: never name a parameter $Args; PowerShell's automatic $args shadows it.
    param([string]$Exe, [string[]]$Arguments, [string]$What, [string]$Cwd = $repoRoot)
    Push-Location $Cwd
    try {
        & $Exe @Arguments
        if ($LASTEXITCODE -ne 0) { throw "$What failed (exit $LASTEXITCODE)." }
    } finally { Pop-Location }
}
function Get-DirSizeMB { param([string]$p)
    if (-not (Test-Path -LiteralPath $p)) { return 0 }
    $b = (Get-ChildItem -LiteralPath $p -Recurse -File -Force | Measure-Object -Property Length -Sum).Sum
    return [math]::Round($b / 1MB, 1)
}

# Keep build caches off C: when the D: cache root exists (machine convention).
if (Test-Path 'D:\build-cache') {
    if (-not $env:npm_config_cache) { $env:npm_config_cache = 'D:\build-cache\npm' }
    if (-not $env:TMP) { $env:TMP = 'D:\build-cache\tmp' }
}

# --- 0. Toolchain ---------------------------------------------------------
Write-Step 'Toolchain'
if (-not $NodeExe) { $NodeExe = (Get-Command node -ErrorAction Stop).Source }
$nodeVersion = (& $NodeExe --version).Trim()
Write-Host "node: $NodeExe ($nodeVersion)"
$ver = [version]($nodeVersion.TrimStart('v'))
if ($ver -lt [version]'22.19.0') { throw "Node $nodeVersion is older than the engine minimum 22.19.0." }
$pnpm = (Get-Command pnpm -ErrorAction Stop).Source
$npm = (Get-Command npm -ErrorAction Stop).Source
$packageVersion = (Get-Content (Join-Path $repoRoot 'package.json') -Raw | ConvertFrom-Json).version
Write-Host "daisyclaw: $packageVersion"

# --- 1. Build ---------------------------------------------------------------
if (-not $SkipUiBuild) {
    Write-Step 'Building Control UI (pnpm ui:build)'
    Invoke-Checked $pnpm @('ui:build') 'pnpm ui:build'
}
if (-not $SkipHostBuild) {
    Write-Step 'Building gateway with consumer lockdown baked ON (pnpm build)'
    $env:DAISYCLAW_CONSUMER_LOCKDOWN_BAKED = '1'
    try { Invoke-Checked $pnpm @('build') 'pnpm build' }
    finally { Remove-Item Env:DAISYCLAW_CONSUMER_LOCKDOWN_BAKED -ErrorAction SilentlyContinue }
}

# The tsdown env replacement must have inlined the flag: the env key may not
# survive into dist as a runtime lookup, or the packaged build would be unlocked.
Write-Step 'Verifying lockdown is baked into dist'
$distRoot = Join-Path $repoRoot 'dist'
if (-not (Test-Path (Join-Path $distRoot 'index.js'))) { throw "dist\index.js missing; run without -SkipHostBuild." }
$leak = Get-ChildItem -LiteralPath $distRoot -Filter '*.js' -File |
    Select-String -Pattern 'process\.env\.DAISYCLAW_CONSUMER_LOCKDOWN_BAKED' -List | Select-Object -First 1
if ($leak) { throw "dist still reads DAISYCLAW_CONSUMER_LOCKDOWN_BAKED at runtime ($($leak.Path)); the flag was not baked." }
if (-not (Test-Path (Join-Path $distRoot 'control-ui\index.html'))) { throw 'dist\control-ui missing; run without -SkipUiBuild.' }
Write-Host 'ok'

# --- 2. Production dependencies --------------------------------------------
Write-Step "Staging production package at $StageDir"
if (Test-Path -LiteralPath $StageDir) { Remove-Item -LiteralPath $StageDir -Recurse -Force }
New-Item -ItemType Directory -Path $StageDir -Force | Out-Null
Push-Location $repoRoot
try {
    # Known: pnpm deploy exits non-zero with ERR_PNPM_UNUSED_PATCH once dev deps
    # are dropped, but it has already written package.json + dist by then.
    & $pnpm deploy --filter=. --prod --legacy $StageDir 2>&1 | Out-Host
    Write-Host "pnpm deploy exit: $LASTEXITCODE (non-zero is expected; verifying output instead)"
} finally { Pop-Location }
if (-not (Test-Path (Join-Path $StageDir 'package.json'))) { throw 'pnpm deploy did not write package.json.' }

Write-Step 'Installing production node_modules (npm install --omit=dev)'
Invoke-Checked $npm @('install', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund', '--loglevel=error') 'npm install' $StageDir
$pkgCount = (Get-ChildItem (Join-Path $StageDir 'node_modules') -Directory | Where-Object { $_.Name -ne '.bin' }).Count
if ($pkgCount -lt 50) { throw "node_modules looks incomplete ($pkgCount top-level entries)." }
Write-Host "top-level packages: $pkgCount"

# --- 3. Assemble ---------------------------------------------------------------
Write-Step "Assembling engine at $OutputDir"
if (Test-Path -LiteralPath $OutputDir) { Remove-Item -LiteralPath $OutputDir -Recurse -Force }
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$robocopy = Join-Path $env:SystemRoot 'System32\robocopy.exe'
function Copy-Tree { param([string]$From, [string]$To)
    New-Item -ItemType Directory -Path $To -Force | Out-Null
    & $robocopy $From $To /E /NFL /NDL /NJH /NJS /NC /NS /NP /R:2 /W:1 | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy $From -> $To failed ($LASTEXITCODE)." }
}

Copy-Item -LiteralPath $NodeExe -Destination (Join-Path $OutputDir 'node.exe')
Copy-Tree (Join-Path $repoRoot 'dist') (Join-Path $OutputDir 'dist')          # freshly built, lockdown ON
Copy-Tree (Join-Path $StageDir 'node_modules') (Join-Path $OutputDir 'node_modules')
Copy-Item -LiteralPath (Join-Path $StageDir 'package.json') -Destination (Join-Path $OutputDir 'package.json')
Copy-Tree (Join-Path $repoRoot 'skills') (Join-Path $OutputDir 'skills')
Copy-Tree (Join-Path $repoRoot 'src\agents\templates') (Join-Path $OutputDir 'src\agents\templates')
Copy-Tree (Join-Path $repoRoot 'docs\reference\templates') (Join-Path $OutputDir 'docs\reference\templates')
Copy-Item -LiteralPath (Join-Path $windowsRoot 'engine-scripts\Manage-DaisyGateway.ps1') -Destination $OutputDir
foreach ($f in @('LICENSE', 'NOTICE.md', 'THIRD_PARTY_NOTICES.md')) {
    $src = Join-Path $repoRoot $f
    if (Test-Path -LiteralPath $src) { Copy-Item -LiteralPath $src -Destination $OutputDir }
}

# --- 4. Trim -------------------------------------------------------------------
Write-Step 'Trimming'
$removed = 0
if (-not $KeepSourceMaps) {
    Get-ChildItem -LiteralPath $OutputDir -Recurse -File -Filter '*.map' | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force; $removed++ }
}
$nm = Join-Path $OutputDir 'node_modules'
# Test folders and docs inside dependencies are never loaded at runtime.
# NB: filter on Name with Where-Object. In Windows PowerShell 5.1, -Include is
# silently ignored with -LiteralPath + -Recurse and would match EVERY file.
Get-ChildItem -LiteralPath $nm -Recurse -Directory -Force |
    Where-Object { $_.Name -in @('test', 'tests', '__tests__', '.github') } |
    ForEach-Object { Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue; $removed++ }
Get-ChildItem -LiteralPath $nm -Recurse -File -Force |
    Where-Object { $_.Name -match '^(?:.*\.(?:md|markdown)|CHANGELOG.*|\.npmignore|\.eslintrc.*|\.prettierrc.*)$' } |
    ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue; $removed++ }
Write-Host "removed $removed files/folders"
$survivors = (Get-ChildItem -LiteralPath $nm -Recurse -File -Force | Measure-Object).Count
if ($survivors -lt 5000) { throw "node_modules trim removed too much ($survivors files left)." }
if (-not (Test-Path (Join-Path $nm 'json5\package.json'))) { throw 'node_modules trim broke json5 (package.json missing).' }
Write-Host "node_modules files after trim: $survivors"

@{
    name = 'daisyclaw-engine'
    version = $packageVersion
    node = $nodeVersion
    consumerLockdown = $true
    builtAt = (Get-Date).ToUniversalTime().ToString('o')
    machine = $env:COMPUTERNAME
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $OutputDir 'engine-manifest.json') -Encoding UTF8

# --- 5. Smoke test (simulated clean machine) ----------------------------------------
Write-Step 'Smoke test'
$fakeHome = Join-Path $StageDir 'fakehome'
New-Item -ItemType Directory -Path $fakeHome -Force | Out-Null
$saved = @{}
foreach ($k in @('USERPROFILE', 'HOME', 'APPDATA', 'LOCALAPPDATA', 'PATH', 'NODE_PATH', 'NODE_OPTIONS')) { $saved[$k] = [Environment]::GetEnvironmentVariable($k) }
try {
    $env:USERPROFILE = $fakeHome; $env:HOME = $fakeHome
    $env:APPDATA = Join-Path $fakeHome 'AppData\Roaming'; $env:LOCALAPPDATA = Join-Path $fakeHome 'AppData\Local'
    $env:PATH = "$env:SystemRoot\System32;$env:SystemRoot"   # no global node/npm/git visible
    Remove-Item Env:NODE_PATH, Env:NODE_OPTIONS -ErrorAction SilentlyContinue
    # Use ProcessStartInfo so stderr is captured as text: with
    # $ErrorActionPreference = 'Stop', `& exe 2>&1` turns any stderr line into
    # a terminating NativeCommandError and hides the real message.
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = Join-Path $OutputDir 'node.exe'
    $psi.Arguments = '"' + (Join-Path $OutputDir 'dist\index.js') + '" --version'
    $psi.WorkingDirectory = $OutputDir
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $proc = [System.Diagnostics.Process]::Start($psi)
    $stdout = $proc.StandardOutput.ReadToEnd()
    $stderr = $proc.StandardError.ReadToEnd()
    $proc.WaitForExit()
    if ($proc.ExitCode -ne 0) { throw "engine smoke test failed (exit $($proc.ExitCode)):`n$stdout`n$stderr" }
    Write-Host "engine reports: $($stdout.Trim())"
} finally {
    foreach ($k in $saved.Keys) { [Environment]::SetEnvironmentVariable($k, $saved[$k]) }
}

# --- 6. Report -----------------------------------------------------------------------
Write-Step 'Engine bundle ready'
"{0,-14} {1,8} MB" -f 'node.exe', [math]::Round((Get-Item (Join-Path $OutputDir 'node.exe')).Length / 1MB, 1)
foreach ($d in @('dist', 'node_modules', 'skills')) { "{0,-14} {1,8} MB" -f $d, (Get-DirSizeMB (Join-Path $OutputDir $d)) }
"{0,-14} {1,8} MB" -f 'TOTAL', (Get-DirSizeMB $OutputDir)
Write-Host "`nOutput: $OutputDir"
