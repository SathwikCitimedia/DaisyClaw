namespace DaisyClaw.Shared.Telemetry;

public enum DaisyClawTelemetryTagKey
{
    Source,
    Outcome,
    ErrorCategory,
    ErrorType,
    Reason,
    Status,
    ClientProtocol,
    GatewayProtocol,
    ProtocolCompatibility
}

/// <summary>
/// Stable tag keys used by DaisyClaw instrumentation.
/// </summary>
public static class DaisyClawTelemetryTags
{
    public static string ToTelemetryName(this DaisyClawTelemetryTagKey key) =>
        key switch
        {
            DaisyClawTelemetryTagKey.Source => "daisyclaw.source",
            DaisyClawTelemetryTagKey.Outcome => "daisyclaw.outcome",
            DaisyClawTelemetryTagKey.ErrorCategory => "daisyclaw.error.category",
            DaisyClawTelemetryTagKey.ErrorType => "error.type",
            DaisyClawTelemetryTagKey.Reason => "daisyclaw.reason",
            DaisyClawTelemetryTagKey.Status => "daisyclaw.status",
            DaisyClawTelemetryTagKey.ClientProtocol => "daisyclaw.protocol.client",
            DaisyClawTelemetryTagKey.GatewayProtocol => "daisyclaw.protocol.gateway",
            DaisyClawTelemetryTagKey.ProtocolCompatibility => "daisyclaw.protocol.compatibility",
            _ => throw new ArgumentOutOfRangeException(nameof(key), key, "Unknown DaisyClaw telemetry tag key.")
        };
}
