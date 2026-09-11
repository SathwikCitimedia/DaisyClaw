using System.Diagnostics.Metrics;

namespace DaisyClaw.Shared.Telemetry;

public enum DaisyClawMeterName
{
    DaisyClaw
}

/// <summary>
/// Stable Meter names used by DaisyClaw metrics.
/// </summary>
public static class DaisyClawMeters
{
    public static Meter DaisyClawMeter { get; } = new(DaisyClawMeterName.DaisyClaw.ToTelemetryName());

    public static string ToTelemetryName(this DaisyClawMeterName meter) =>
        meter switch
        {
            DaisyClawMeterName.DaisyClaw => "daisyclaw",
            _ => throw new ArgumentOutOfRangeException(nameof(meter), meter, "Unknown DaisyClaw meter.")
        };

    internal static Meter ToMeter(this DaisyClawMeterName meter) =>
        meter switch
        {
            DaisyClawMeterName.DaisyClaw => DaisyClawMeter,
            _ => throw new ArgumentOutOfRangeException(nameof(meter), meter, "Unknown DaisyClaw meter.")
        };
}
