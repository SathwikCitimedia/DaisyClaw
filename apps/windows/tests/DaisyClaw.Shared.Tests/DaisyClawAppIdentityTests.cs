using DaisyClaw.Shared;

namespace DaisyClaw.Shared.Tests;

public sealed class DaisyClawAppIdentityTests
{
    [Fact]
    public void ResolveRoamingDataDirectory_DefaultsToReleaseProfile()
    {
        var root = Path.Combine(Path.GetTempPath(), "daisyclaw-appdata");
        var path = DaisyClawAppIdentity.ResolveRoamingDataDirectory(
            key => key == DaisyClawAppIdentity.AppDataRootEnvironmentVariable ? root : null);

        Assert.Equal(Path.Combine(root, "DaisyClawTray"), path);
    }

    [Fact]
    public void ResolveRoamingDataDirectory_UsesDevProfileFromEnvironment()
    {
        var root = Path.Combine(Path.GetTempPath(), "daisyclaw-appdata");
        var path = DaisyClawAppIdentity.ResolveRoamingDataDirectory(
            key => key switch
            {
                DaisyClawAppIdentity.AppDataRootEnvironmentVariable => root,
                DaisyClawAppIdentity.IdentityEnvironmentVariable => DaisyClawAppIdentity.DevIdentity,
                _ => null
            });

        Assert.Equal(Path.Combine(root, "DaisyClawTray-Dev"), path);
    }

    [Fact]
    public void ResolveRoamingDataDirectory_ExplicitIdentityWinsOverEnvironment()
    {
        var root = Path.Combine(Path.GetTempPath(), "daisyclaw-appdata");
        var path = DaisyClawAppIdentity.ResolveRoamingDataDirectory(
            key => key switch
            {
                DaisyClawAppIdentity.AppDataRootEnvironmentVariable => root,
                DaisyClawAppIdentity.IdentityEnvironmentVariable => DaisyClawAppIdentity.DevIdentity,
                _ => null
            },
            explicitIdentity: DaisyClawAppIdentity.ReleaseIdentity);

        Assert.Equal(Path.Combine(root, "DaisyClawTray"), path);
    }

    [Fact]
    public void ResolveRoamingDataDirectory_DataDirOverrideWinsOverIdentity()
    {
        var direct = Path.Combine(Path.GetTempPath(), "daisyclaw-direct-data");
        var path = DaisyClawAppIdentity.ResolveRoamingDataDirectory(
            key => key switch
            {
                DaisyClawAppIdentity.DataDirectoryOverrideEnvironmentVariable => direct,
                DaisyClawAppIdentity.IdentityEnvironmentVariable => DaisyClawAppIdentity.DevIdentity,
                _ => null
            });

        Assert.Equal(direct, path);
    }

    [Fact]
    public void ResolveSettingsAndTokenPaths_UseSelectedProfile()
    {
        var root = Path.Combine(Path.GetTempPath(), "daisyclaw-appdata");
        Func<string, string?> env = key =>
            key == DaisyClawAppIdentity.AppDataRootEnvironmentVariable ? root : null;

        Assert.Equal(
            Path.Combine(root, "DaisyClawTray-Dev", "settings.json"),
            DaisyClawAppIdentity.ResolveSettingsPath(env, DaisyClawAppIdentity.DevIdentity));
        Assert.Equal(
            Path.Combine(root, "DaisyClawTray-Dev", "mcp-token.txt"),
            DaisyClawAppIdentity.ResolveMcpTokenPath(env, DaisyClawAppIdentity.DevIdentity));
    }

    [Fact]
    public void NormalizeIdentity_RejectsUnknownIdentity()
    {
        var ex = Assert.Throws<ArgumentException>(() => DaisyClawAppIdentity.NormalizeIdentity("staging"));

        Assert.Contains("release", ex.Message);
        Assert.Contains("dev", ex.Message);
    }
}
