namespace DaisyClaw.Tray.Tests;

public sealed class ReleaseSigningWorkflowTests
{
    [Fact]
    public void ReleaseWorkflow_SignsOnlyDaisyClawOwnedPayloadBinaries()
    {
        var workflow = File.ReadAllText(Path.Combine(TestRepositoryPaths.GetRepositoryRoot(), ".github", "workflows", "ci.yml"));

        Assert.DoesNotContain("azure/trusted-signing-action", workflow);
        Assert.DoesNotContain("AZURE_CLIENT_SECRET", workflow);
        Assert.Contains("environment: release-signing", workflow);
        Assert.Contains("id-token: write", workflow);
        Assert.Contains("uses: azure/artifact-signing-action@v2", workflow);
        Assert.Contains("endpoint: https://eus.codesigning.azure.net/", workflow);
        Assert.Contains("signing-account-name: daisyclaw", workflow);
        Assert.Contains("certificate-profile-name: daisyclaw", workflow);
        Assert.Contains("Stage x64 DaisyClaw Binaries for Signing", workflow);
        Assert.Contains("DaisyClaw.Tray.WinUI.exe", workflow);
        Assert.Contains("DaisyClaw.Tray.WinUI.dll", workflow);
        Assert.Contains("DaisyClaw.Chat.dll", workflow);
        Assert.Contains("DaisyClaw.Connection.dll", workflow);
        Assert.Contains("DaisyClaw.SetupEngine.UI.dll", workflow);
        Assert.Contains("DaisyClaw.SetupEngine.dll", workflow);
        Assert.Contains("DaisyClaw.Shared.dll", workflow);
        Assert.Contains("DaisyClawTray.FunctionalUI.dll", workflow);
        Assert.Contains(@"New-Item -ItemType HardLink -Path ""signing-input-x64\$binary"" -Target ""artifacts\tray-win-x64\$binary""", workflow);
        Assert.DoesNotContain("signing-input-x64\\DaisyClaw.SetupEngine.exe", workflow);
        Assert.DoesNotContain("signing-input-x64\\DaisyClaw.SetupEngine.UI.exe", workflow);
        Assert.Contains("Sign x64 DaisyClaw Binaries", workflow);
        Assert.Contains("files-folder: signing-input-x64", workflow);
        Assert.Contains("Stage ARM64 DaisyClaw Binaries for Signing", workflow);
        Assert.Contains(@"New-Item -ItemType HardLink -Path ""signing-input-arm64\$binary"" -Target ""artifacts\tray-win-arm64\$binary""", workflow);
        Assert.DoesNotContain("signing-input-arm64\\DaisyClaw.SetupEngine.exe", workflow);
        Assert.DoesNotContain("signing-input-arm64\\DaisyClaw.SetupEngine.UI.exe", workflow);
        Assert.Contains("Sign ARM64 DaisyClaw Binaries", workflow);
        Assert.Contains("files-folder: signing-input-arm64", workflow);
        Assert.Contains("files-folder-filter: exe,dll", workflow);
        Assert.DoesNotContain("files-folder-recurse: true", workflow);
    }

    [Fact]
    public void ReleaseWorkflow_VerifiesExecutableSigningPolicy()
    {
        var workflow = File.ReadAllText(Path.Combine(TestRepositoryPaths.GetRepositoryRoot(), ".github", "workflows", "ci.yml"));
        var verifier = File.ReadAllText(Path.Combine(TestRepositoryPaths.GetRepositoryRoot(), "scripts", "Test-ReleaseExecutableSignatures.ps1"));

        Assert.Contains("Test-ReleaseExecutableSignatures.ps1 -PayloadPath artifacts/tray-win-x64 -RequireSignedDaisyClaw", workflow);
        Assert.Contains("Test-ReleaseExecutableSignatures.ps1 -PayloadPath artifacts/tray-win-arm64 -RequireSignedDaisyClaw", workflow);
        Assert.Contains(@"^DaisyClaw\.Tray\.WinUI\.exe$", verifier);
        Assert.Contains(@"^DaisyClaw\.Tray\.WinUI\.dll$", verifier);
        Assert.Contains(@"^DaisyClaw\.Chat\.dll$", verifier);
        Assert.Contains(@"^DaisyClaw\.Connection\.dll$", verifier);
        Assert.Contains(@"^DaisyClaw\.SetupEngine\.UI\.dll$", verifier);
        Assert.Contains(@"^DaisyClaw\.SetupEngine\.dll$", verifier);
        Assert.Contains(@"^DaisyClaw\.Shared\.dll$", verifier);
        Assert.Contains(@"^DaisyClawTray\.FunctionalUI\.dll$", verifier);
        Assert.DoesNotContain(@"^SetupEngine\\DaisyClaw\.SetupEngine\.exe$", verifier);
        Assert.DoesNotContain(@"^SetupEngine\\DaisyClaw\.SetupEngine\.UI\.exe$", verifier);
        Assert.Contains("SetupEngine\\DaisyClaw.SetupEngine.exe should not be present", verifier);
        Assert.Contains("SetupEngine\\DaisyClaw.SetupEngine.UI.exe should not be present", verifier);
        Assert.Contains(@"(^|\\)createdump\.exe$", verifier);
        Assert.Contains(@"(^|\\)RestartAgent\.exe$", verifier);
        Assert.Contains(@"^tools\\mxc\\[^\\]+\\wxc-exec\.exe$", verifier);
        Assert.Contains("Unknown executable in release payload", verifier);
        Assert.Contains("Unknown DaisyClaw binary in release payload", verifier);
        Assert.Contains("$DaisyClawSignerSubject", verifier);
        Assert.Contains("[StringComparison]::OrdinalIgnoreCase", verifier);
        Assert.Contains("DaisyClaw binary is not signed by the expected DaisyClaw signer", verifier);
    }

    [Fact]
    public void ReleaseWorkflow_BundlesAndVerifiesNativeRuntimeDependencies()
    {
        var root = TestRepositoryPaths.GetRepositoryRoot();
        var workflow = File.ReadAllText(Path.Combine(root, ".github", "workflows", "ci.yml"));
        var installer = File.ReadAllText(Path.Combine(root, "installer.iss"));
        var verifier = File.ReadAllText(Path.Combine(root, "scripts", "Test-ReleaseNativeDependencies.ps1"));
        var targets = File.ReadAllText(Path.Combine(root, "src", "Directory.Build.targets"));

        Assert.Contains("Test-ReleaseNativeDependencies.ps1 -PayloadPath publish -RequireAppLocalVCRuntime", workflow);
        Assert.Contains("Test-ReleaseNativeDependencies.ps1 -PayloadPath artifacts/tray-win-x64 -RequireAppLocalVCRuntime", workflow);
        Assert.Contains("Test-ReleaseNativeDependencies.ps1 -PayloadPath artifacts/tray-win-arm64 -RequireAppLocalVCRuntime -SkipNativeLoadProbe", workflow);
        Assert.Contains("https://aka.ms/vc14/vc_redist.x64.exe", workflow);
        Assert.Contains("https://aka.ms/vc14/vc_redist.arm64.exe", workflow);
        Assert.Contains("Get-AuthenticodeSignature -LiteralPath $redist.Path", workflow);
        Assert.Contains("O=Microsoft Corporation", workflow);
        Assert.Contains("-InstallerVCRedistPath vc_redist.x64.exe", workflow);
        Assert.Contains("publish-arm64 -RequireAppLocalVCRuntime -RequireInstallerVCRedist -InstallerVCRedistPath vc_redist.arm64.exe -SkipNativeLoadProbe", workflow);
        Assert.Contains("/DvcRedist=vc_redist.x64.exe", workflow);
        Assert.Contains("/DvcRedist=vc_redist.arm64.exe", workflow);
        Assert.DoesNotContain("copy vc_redist.x64.exe publish-x64", workflow);
        Assert.DoesNotContain("copy vc_redist.x64.exe publish-arm64", workflow);
        Assert.Contains("DaisyClawTray-${{ needs.metadata.outputs.semVer }}-win-arm64.zip", workflow);
        Assert.Contains("AfterInstall: InstallVCRuntime", installer);
        Assert.Contains("Exec(", installer);
        Assert.Contains("ResultCode = 3010", installer);
        Assert.Contains("ShouldLaunchTray", installer);
        Assert.Contains("Skipping post-install tray launch", installer);
        Assert.DoesNotContain(@"Filename: ""{tmp}\vc_redist.exe""", installer);
        Assert.Contains("Get-AuthenticodeSignature -LiteralPath $File.FullName", verifier);
        Assert.Contains("Get-VCRuntimeFiles", verifier);
        Assert.Contains("vcruntime140.dll", verifier);
        Assert.DoesNotContain("libsodium.dll", verifier);
        Assert.Contains("DaisyClawNativeDependencyProbe", verifier);
        Assert.Contains("Microsoft.ML.OnnxRuntime.dll", verifier);
        Assert.Contains("onnxruntime.dll", verifier);
        Assert.Contains("sherpa-onnx-c-api.dll", verifier);
        Assert.Contains("TTS native stack probe", verifier);
        Assert.Contains("SkipNativeLoadProbe", verifier);
        Assert.Contains("CopyDaisyClawVCRuntimeToPublish", targets);
        Assert.Contains("ResolveDaisyClawVCRuntimeFromVSInstall", targets);
        Assert.Contains("ResolveDaisyClawVCRuntimeArm64FromVSInstall", targets);
        Assert.Contains("VCRuntimeMinVersion", verifier);
    }

    [Fact]
    public void ReleaseWorkflow_PausesMsixDistribution()
    {
        var workflow = File.ReadAllText(Path.Combine(TestRepositoryPaths.GetRepositoryRoot(), ".github", "workflows", "ci.yml"));

        Assert.Contains("if: false # MSIX distribution is paused; ship Inno setup and portable ZIP artifacts only.", workflow);
        Assert.Contains("needs: [change-classification, metadata, build-x64, build-arm64, ci-gate]", workflow);
        Assert.DoesNotContain("Download win-x64 MSIX artifact", workflow);
        Assert.DoesNotContain("Download win-arm64 MSIX artifact", workflow);
        Assert.DoesNotContain("Sign Release MSIX Packages", workflow);
        Assert.DoesNotContain(".msix", ExtractReleaseStep(workflow));
    }

    private static string ExtractReleaseStep(string workflow)
    {
        var start = workflow.IndexOf("    - name: Create Release", StringComparison.Ordinal);
        Assert.True(start >= 0, "Could not find Create Release step.");
        return workflow[start..];
    }

}
