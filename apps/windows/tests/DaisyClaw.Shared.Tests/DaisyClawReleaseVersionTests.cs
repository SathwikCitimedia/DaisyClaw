using DaisyClaw.Shared;

namespace DaisyClaw.Shared.Tests;

public sealed class DaisyClawReleaseVersionTests
{
    [Theory]
    [InlineData("2026.7.1", 2026, 7, 1, 0)]
    [InlineData("v2026.7.1-2", 2026, 7, 1, 2)]
    [InlineData(" 2026.12.34-15 ", 2026, 12, 34, 15)]
    public void TryParseStable_AcceptsFinalAndCorrectionVersions(
        string value,
        int year,
        int month,
        int patch,
        int correction)
    {
        Assert.True(DaisyClawReleaseVersion.TryParseStable(value, out var parsed));
        Assert.Equal(new DaisyClawReleaseVersion(year, month, patch, correction), parsed);
    }

    [Theory]
    [InlineData("2026.7.1-alpha.2")]
    [InlineData("2026.7.1-beta.2")]
    [InlineData("2026.7.1-0")]
    [InlineData("2026.7.1-02")]
    [InlineData("2026.07.1-2")]
    [InlineData("2026.7")]
    [InlineData("")]
    public void TryParseStable_RejectsPrereleaseAndMalformedVersions(string value)
    {
        Assert.False(DaisyClawReleaseVersion.TryParseStable(value, out _));
    }

    [Theory]
    [InlineData("v2026.7.1-1", "2026.7.1")]
    [InlineData("v2026.7.1-3", "2026.7.1-2")]
    [InlineData("v2026.7.2", "2026.7.1-2")]
    [InlineData("v2027.1.1", "2026.12.99-9")]
    public void IsNewerStableRelease_AcceptsMonotonicCorrections(
        string candidate,
        string current)
    {
        Assert.True(DaisyClawReleaseVersion.IsNewerStableRelease(candidate, current));
    }

    [Theory]
    [InlineData("v2026.7.1", "2026.7.1")]
    [InlineData("v2026.7.1-1", "2026.7.1-2")]
    [InlineData("v2026.7.1-beta.3", "2026.7.1-2")]
    [InlineData("invalid", "2026.7.1-2")]
    public void IsNewerStableRelease_RejectsNonNewerOrNonStableCandidates(
        string candidate,
        string current)
    {
        Assert.False(DaisyClawReleaseVersion.IsNewerStableRelease(candidate, current));
    }
}
