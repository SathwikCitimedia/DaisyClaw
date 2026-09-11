<#
.SYNOPSIS
    Verifies release payload binary signing policy.

.DESCRIPTION
    Classifies every .exe and .dll in a release payload. DaisyClaw-owned binaries
    must be signed when -RequireSignedDaisyClaw is passed. Third-party binaries,
    including wxc-exec.exe, must not be signed by the DaisyClaw release signer.
    Unknown executables and unknown DaisyClaw-named binaries fail closed.

.PARAMETER PayloadPath
    Root directory of the release payload to inspect.

.PARAMETER RequireSignedDaisyClaw
    Require DaisyClaw-owned binaries to have valid Authenticode signatures.

.PARAMETER DaisyClawSignerSubject
    Exact certificate subject required for DaisyClaw-owned binaries.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$PayloadPath,

    [switch]$RequireSignedDaisyClaw,

    [string]$DaisyClawSignerSubject = "CN=DaisyClaw Foundation, O=DaisyClaw Foundation, L=Mill Valley, S=California, C=US"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$payloadRoot = (Resolve-Path -LiteralPath $PayloadPath).Path

function Get-RelativePath {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$Path
    )

    [System.IO.Path]::GetRelativePath($Root, $Path).Replace('/', '\')
}

function Get-BinaryClassification {
    param([Parameter(Mandatory = $true)][string]$RelativePath)

    switch -Regex ($RelativePath) {
        '^DaisyClaw\.Tray\.WinUI\.exe$' { return "DaisyClawOwned" }
        '^DaisyClaw\.Tray\.WinUI\.dll$' { return "DaisyClawOwned" }
        '^DaisyClaw\.Chat\.dll$' { return "DaisyClawOwned" }
        '^DaisyClaw\.Connection\.dll$' { return "DaisyClawOwned" }
        '^DaisyClaw\.SetupEngine\.UI\.dll$' { return "DaisyClawOwned" }
        '^DaisyClaw\.SetupEngine\.dll$' { return "DaisyClawOwned" }
        '^DaisyClaw\.Shared\.dll$' { return "DaisyClawOwned" }
        '^DaisyClawTray\.FunctionalUI\.dll$' { return "DaisyClawOwned" }
        '(^|\\)createdump\.exe$' { return "ThirdPartyExcluded" }
        '(^|\\)RestartAgent\.exe$' { return "ThirdPartyExcluded" }
        '^tools\\mxc\\[^\\]+\\wxc-exec\.exe$' { return "ThirdPartyExcluded" }
        '(^|\\)DaisyClaw[^\\]*\.(exe|dll)$' { return "UnknownDaisyClaw" }
        '\.dll$' { return "ThirdPartyExcluded" }
        default { return "UnknownExecutable" }
    }
}

$binaries = @(
    Get-ChildItem -LiteralPath $payloadRoot -Recurse -File |
        Where-Object { $_.Extension -in ".exe", ".dll" } |
        Sort-Object FullName |
        ForEach-Object {
            $relativePath = Get-RelativePath -Root $payloadRoot -Path $_.FullName
            $signature = Get-AuthenticodeSignature -LiteralPath $_.FullName
            $signerSubject = if ($signature.SignerCertificate) { $signature.SignerCertificate.Subject } else { "" }
            [pscustomobject]@{
                RelativePath = $relativePath
                Classification = Get-BinaryClassification -RelativePath $relativePath
                SignatureStatus = $signature.Status.ToString()
                SignerSubject = $signerSubject
            }
        }
)

if ($binaries.Count -eq 0) {
    throw "No executable or DLL binaries found under $payloadRoot."
}

$binaries | Format-Table -AutoSize

$errors = New-Object System.Collections.Generic.List[string]

foreach ($binary in $binaries) {
    switch ($binary.Classification) {
        "DaisyClawOwned" {
            if ($RequireSignedDaisyClaw -and $binary.SignatureStatus -ne "Valid") {
                $errors.Add("DaisyClaw binary is not validly signed: $($binary.RelativePath) [$($binary.SignatureStatus)]")
            }
            elseif ($RequireSignedDaisyClaw -and
                    -not [string]::Equals(
                        $binary.SignerSubject,
                        $DaisyClawSignerSubject,
                        [StringComparison]::OrdinalIgnoreCase)) {
                $errors.Add("DaisyClaw binary is not signed by the expected DaisyClaw signer: $($binary.RelativePath) [$($binary.SignerSubject)]")
            }
        }
        "ThirdPartyExcluded" {
            if ($binary.SignatureStatus -eq "Valid" -and
                [string]::Equals(
                    $binary.SignerSubject,
                    $DaisyClawSignerSubject,
                    [StringComparison]::OrdinalIgnoreCase)) {
                $errors.Add("Third-party binary appears to be signed by DaisyClaw release signer: $($binary.RelativePath) [$($binary.SignerSubject)]")
            }
        }
        "UnknownDaisyClaw" {
            $errors.Add("Unknown DaisyClaw binary in release payload: $($binary.RelativePath)")
        }
        default {
            $errors.Add("Unknown executable in release payload: $($binary.RelativePath)")
        }
    }
}

@(
    "DaisyClaw.Tray.WinUI.exe",
    "DaisyClaw.Tray.WinUI.dll",
    "DaisyClaw.Chat.dll",
    "DaisyClaw.Connection.dll",
    "DaisyClaw.SetupEngine.UI.dll",
    "DaisyClaw.SetupEngine.dll",
    "DaisyClaw.Shared.dll",
    "DaisyClawTray.FunctionalUI.dll"
) | ForEach-Object {
    $requiredBinary = $_
    if (-not ($binaries | Where-Object RelativePath -eq $requiredBinary)) {
        $errors.Add("Missing DaisyClaw binary: $_.")
    }
}
if ($binaries | Where-Object RelativePath -eq "SetupEngine\DaisyClaw.SetupEngine.UI.exe") {
    $errors.Add("SetupEngine\DaisyClaw.SetupEngine.UI.exe should not be present in the release payload.")
}
if ($binaries | Where-Object RelativePath -eq "SetupEngine\DaisyClaw.SetupEngine.exe") {
    $errors.Add("SetupEngine\DaisyClaw.SetupEngine.exe should not be present in the release payload.")
}
if (-not ($binaries | Where-Object RelativePath -match '^tools\\mxc\\[^\\]+\\wxc-exec\.exe$')) {
    $errors.Add("Missing tools\mxc\<arch>\wxc-exec.exe third-party executable.")
}

if ($errors.Count -gt 0) {
    $errors | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Host "Release binary signing policy passed." -ForegroundColor Green
