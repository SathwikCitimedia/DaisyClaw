using System.Diagnostics;

namespace DaisyClaw.Shared.Telemetry;

public enum DaisyClawActivitySourceName
{
    DaisyClaw
}

/// <summary>
/// Stable ActivitySource names used by DaisyClaw instrumentation.
/// </summary>
public static class DaisyClawActivitySources
{
    public static ActivitySource DaisyClawSource { get; } = new(DaisyClawActivitySourceName.DaisyClaw.ToTelemetryName());

    public static string ToTelemetryName(this DaisyClawActivitySourceName source) =>
        source switch
        {
            DaisyClawActivitySourceName.DaisyClaw => "daisyclaw",
            _ => throw new ArgumentOutOfRangeException(nameof(source), source, "Unknown DaisyClaw activity source.")
        };

    internal static ActivitySource ToActivitySource(this DaisyClawActivitySourceName source) =>
        source switch
        {
            DaisyClawActivitySourceName.DaisyClaw => DaisyClawSource,
            _ => throw new ArgumentOutOfRangeException(nameof(source), source, "Unknown DaisyClaw activity source.")
        };
}
