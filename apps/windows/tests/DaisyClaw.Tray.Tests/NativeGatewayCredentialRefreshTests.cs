using DaisyClaw.Connection;
using DaisyClawTray.Services;

namespace DaisyClaw.Tray.Tests;

/// <summary>
/// The engine's config file owns the shared token. These tests pin the rule
/// that the tray always carries the engine's current token, not the copy its
/// record took at an earlier launch (the cause of the login form after an
/// upgrade install).
/// </summary>
public sealed class NativeGatewayCredentialRefreshTests : IDisposable
{
    private readonly string _tempDir;
    private readonly GatewayRegistry _registry;

    public NativeGatewayCredentialRefreshTests()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), "daisyclaw-cred-refresh-" + Guid.NewGuid().ToString("N")[..8]);
        Directory.CreateDirectory(_tempDir);
        _registry = new GatewayRegistry(_tempDir);
    }

    public void Dispose()
    {
        // slopwatch-ignore: SW003 Test cleanup is best-effort.
        try { Directory.Delete(_tempDir, true); } catch { }
    }

    private GatewayRecord SeedActive(string url, string? token)
    {
        var record = _registry.AddOrUpdate(new GatewayRecord
        {
            Id = "native",
            Url = url,
            IsLocal = true,
            FriendlyName = "Daisy (this PC)",
            SharedGatewayToken = token,
        });
        _registry.SetActive(record.Id);
        _registry.Save();
        return record;
    }

    [Fact]
    public void Matches_LoopbackSamePort_IgnoresHostSpellingAndScheme()
    {
        var record = new GatewayRecord { Id = "n", Url = "ws://localhost:18789", IsLocal = true };

        Assert.True(NativeGatewayCredentialRefresh.Matches(record, "ws://127.0.0.1:18789"));
        Assert.True(NativeGatewayCredentialRefresh.Matches(record, "http://127.0.0.1:18789"));
    }

    [Fact]
    public void Matches_DifferentPortOrRemoteHost_IsFalse()
    {
        var record = new GatewayRecord { Id = "n", Url = "ws://127.0.0.1:18789", IsLocal = true };

        Assert.False(NativeGatewayCredentialRefresh.Matches(record, "ws://127.0.0.1:18790"));
        Assert.False(NativeGatewayCredentialRefresh.Matches(
            new GatewayRecord { Id = "r", Url = "wss://gateway.example:18789" },
            "ws://127.0.0.1:18789"));
    }

    [Fact]
    public void ResolveSharedToken_ReturnsEngineTokenOnlyForTheNativeRecord()
    {
        var native = new GatewayRecord { Id = "n", Url = "ws://127.0.0.1:18789", IsLocal = true, SharedGatewayToken = "old" };
        var remote = new GatewayRecord { Id = "r", Url = "wss://gateway.example", SharedGatewayToken = "remote" };
        var configured = ("ws://127.0.0.1:18789", (string?)"fresh");

        Assert.Equal("fresh", NativeGatewayCredentialRefresh.ResolveSharedToken(native, configured));
        Assert.Null(NativeGatewayCredentialRefresh.ResolveSharedToken(remote, configured));
        Assert.Null(NativeGatewayCredentialRefresh.ResolveSharedToken(native, null));
        Assert.Null(NativeGatewayCredentialRefresh.ResolveSharedToken(native, ("ws://127.0.0.1:18789", null)));
    }

    [Fact]
    public void RefreshActiveRecord_RotatedEngineToken_IsWrittenToTheRecord()
    {
        SeedActive("ws://127.0.0.1:18789", "token-from-last-launch");

        var changed = NativeGatewayCredentialRefresh.RefreshActiveRecord(
            _registry,
            ("ws://127.0.0.1:18789", "token-after-reinstall"));

        Assert.True(changed);
        Assert.Equal("token-after-reinstall", _registry.GetActive()!.SharedGatewayToken);

        // Persisted, not just in memory: a fresh registry instance sees it.
        var reloaded = new GatewayRegistry(_tempDir);
        reloaded.Load();
        Assert.Equal("token-after-reinstall", reloaded.GetActive()!.SharedGatewayToken);
    }

    [Fact]
    public void RefreshActiveRecord_UnchangedToken_DoesNothing()
    {
        SeedActive("ws://127.0.0.1:18789", "same");

        Assert.False(NativeGatewayCredentialRefresh.RefreshActiveRecord(_registry, ("ws://127.0.0.1:18789", "same")));
        Assert.Equal("same", _registry.GetActive()!.SharedGatewayToken);
    }

    [Fact]
    public void RefreshActiveRecord_NoEngineConfigOrNoRegistry_DoesNothing()
    {
        SeedActive("ws://127.0.0.1:18789", "keep");

        Assert.False(NativeGatewayCredentialRefresh.RefreshActiveRecord(_registry, null));
        Assert.False(NativeGatewayCredentialRefresh.RefreshActiveRecord(null, ("ws://127.0.0.1:18789", "x")));
        Assert.Equal("keep", _registry.GetActive()!.SharedGatewayToken);
    }

    [Fact]
    public void RefreshActiveRecord_RemoteActiveRecord_IsLeftAlone()
    {
        SeedActive("wss://gateway.example", "remote-token");

        Assert.False(NativeGatewayCredentialRefresh.RefreshActiveRecord(_registry, ("ws://127.0.0.1:18789", "engine")));
        Assert.Equal("remote-token", _registry.GetActive()!.SharedGatewayToken);
    }
}
