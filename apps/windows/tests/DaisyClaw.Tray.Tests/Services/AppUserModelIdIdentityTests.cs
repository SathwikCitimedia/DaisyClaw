using System.IO;
using DaisyClawTray;
using Xunit;

namespace DaisyClaw.Tray.Tests.Services;

public sealed class AppUserModelIdIdentityTests
{
    [Fact]
    public void WinUiProject_UsesHumanReadableMetadataForNotificationSenderFallback()
    {
        var project = File.ReadAllText(Path.Combine(
            TestRepositoryPaths.GetRepositoryRoot(),
            "src",
            "DaisyClaw.Tray.WinUI",
            "DaisyClaw.Tray.WinUI.csproj"));

        Assert.Contains("<AssemblyTitle>DaisyClaw Companion</AssemblyTitle>", project);
        Assert.Contains("<FileDescription>DaisyClaw Companion</FileDescription>", project);
        Assert.Contains("<Product>DaisyClaw Companion</Product>", project);
        Assert.Contains("<AssemblyTitle>DaisyClaw Companion (Dev)</AssemblyTitle>", project);
        Assert.Contains("<FileDescription>DaisyClaw Companion (Dev)</FileDescription>", project);
        Assert.Contains("<Product>DaisyClaw Companion (Dev)</Product>", project);
        Assert.DoesNotContain("<AssemblyTitle>DaisyClaw.Tray.WinUI</AssemblyTitle>", project);
    }

    [Fact]
    public void Registrar_SkipsExplicitAumidWhenMsixPackageIdentityExists()
    {
        var source = File.ReadAllText(Path.Combine(
            TestRepositoryPaths.GetRepositoryRoot(),
            "src",
            "DaisyClaw.Tray.WinUI",
            "Services",
            "AppUserModelIdRegistrar.cs"));

        Assert.Contains("GetCurrentPackageFullName", source);
        Assert.Contains("AppModelErrorNoPackage", source);
        Assert.Contains("HResult", source);
        Assert.Contains("SetCurrentProcessExplicitAppUserModelID", source);
    }

    [Fact]
    public void AppUserModelId_UsesCompanionIdentity()
    {
        Assert.Equal(AppIdentity.PackageIdentityName, AppIdentity.AppUserModelId);
        Assert.DoesNotContain("DaisyClaw.Tray.WinUI", AppIdentity.AppUserModelId);
    }

    [Fact]
    public void InstallerAumid_MatchesRuntimeAppUserModelId()
    {
        var iss = File.ReadAllText(Path.Combine(
            TestRepositoryPaths.GetRepositoryRoot(),
            "installer.iss"));

        Assert.Contains($@"#define MyAppAumid ""{AppIdentity.AppUserModelId}""", iss);
        Assert.Contains(@"#define MyAppAumid ""DaisyClaw.Companion.Dev""", iss);
    }

    [Fact]
    public void UnpackagedManifest_UsesCompanionIdentityForSystemPrompts()
    {
        var manifest = File.ReadAllText(Path.Combine(
            TestRepositoryPaths.GetRepositoryRoot(),
            "src",
            "DaisyClaw.Tray.WinUI",
            "app.manifest"));

        Assert.Contains(@"<assemblyIdentity version=""1.0.0.0"" name=""DaisyClaw.Companion""/>", manifest);
        Assert.DoesNotContain(@"name=""DaisyClaw.Tray.WinUI""", manifest);
    }

    [Fact]
    public void ApprovalPopups_UseCompanionDisplayName()
    {
        var root = TestRepositoryPaths.GetRepositoryRoot();
        var pairingDialog = File.ReadAllText(Path.Combine(root, "src", "DaisyClaw.Tray.WinUI", "Dialogs", "PairingApprovalDialog.cs"));
        var recordingDialog = File.ReadAllText(Path.Combine(root, "src", "DaisyClaw.Tray.WinUI", "Dialogs", "RecordingConsentDialog.cs"));
        var execPrompt = File.ReadAllText(Path.Combine(root, "src", "DaisyClaw.Tray.WinUI", "Dialogs", "ExecApprovalDialog.cs"));

        Assert.Contains("AppIdentity.DisplayName", pairingDialog);
        Assert.Contains("AppIdentity.DisplayName", recordingDialog);
        Assert.Contains("AppIdentity.DisplayName", execPrompt);
        Assert.DoesNotContain("DaisyClaw · Permission Request", File.ReadAllText(Path.Combine(root, "src", "DaisyClaw.Tray.WinUI", "Strings", "en-us", "Resources.resw")));
        Assert.Contains("ExecApproval_WindowTitle", execPrompt);
        Assert.DoesNotContain("DaisyClaw.Tray.WinUI", pairingDialog);
        Assert.DoesNotContain("DaisyClaw.Tray.WinUI", recordingDialog);
        Assert.DoesNotContain("DaisyClaw.Tray.WinUI", execPrompt);
    }
}
