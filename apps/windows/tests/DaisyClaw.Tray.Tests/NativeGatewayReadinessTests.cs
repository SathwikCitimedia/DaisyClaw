using DaisyClawTray.Services;
using Xunit;

namespace DaisyClaw.Tray.Tests;

/// <summary>
/// Pins what "the gateway is usable" means to the tray.
///
/// The engine binds its HTTP port several seconds before it accepts gateway
/// connections. The app used to treat any HTTP answer as healthy, so it opened
/// the dashboard into that window and the user met a login form on a cold
/// start. Readiness is asked for explicitly now, and the still-starting window
/// must not count as ready.
/// </summary>
public sealed class NativeGatewayReadinessTests
{
    [Fact]
    public void ReadyStatusCountsAsUsable()
    {
        Assert.True(NativeGatewaySupervisor.InterpretReadinessResponse(200));
    }

    [Fact]
    public void StillStartingDoesNotCountAsUsable()
    {
        // 503 is what the engine returns while its startup sidecars load.
        Assert.False(NativeGatewaySupervisor.InterpretReadinessResponse(503));
    }

    [Theory]
    [InlineData(404)]
    [InlineData(405)]
    public void EngineWithoutTheEndpointFallsBackToLiveness(int statusCode)
    {
        // An older engine has no readiness endpoint; something answering is then
        // the strongest signal available, and refusing it would strand the user.
        Assert.True(NativeGatewaySupervisor.InterpretReadinessResponse(statusCode));
    }

    [Theory]
    [InlineData(500)]
    [InlineData(502)]
    [InlineData(0)]
    public void OtherFailuresAreNotUsable(int statusCode)
    {
        Assert.False(NativeGatewaySupervisor.InterpretReadinessResponse(statusCode));
    }
}
