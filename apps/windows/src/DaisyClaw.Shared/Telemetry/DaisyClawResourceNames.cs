namespace DaisyClaw.Shared.Telemetry;

public enum DaisyClawResourceName
{
    WindowsTray,
    WindowsNode
}

/// <summary>
/// Stable resource names used by DaisyClaw telemetry exporters.
/// </summary>
public static class DaisyClawResourceNames
{
    public static string ToServiceName(this DaisyClawResourceName resource) =>
        resource switch
        {
            DaisyClawResourceName.WindowsTray => "daisyclaw-windows-tray",
            DaisyClawResourceName.WindowsNode => "daisyclaw-windows",
            _ => throw new ArgumentOutOfRangeException(nameof(resource), resource, "Unknown DaisyClaw resource name.")
        };
}
