namespace DaisyClaw.Shared.Telemetry;

/// <summary>
/// Explicit non-sensitive telemetry tag supplied by instrumentation call sites.
/// </summary>
public sealed class DaisyClawTelemetryTag
{
    public DaisyClawTelemetryTag(DaisyClawTelemetryTagKey key, object? value)
        : this(key.ToTelemetryName(), value)
    {
    }

    private DaisyClawTelemetryTag(string key, object? value)
    {
        if (string.IsNullOrWhiteSpace(key))
            throw new ArgumentException("Telemetry tag key cannot be empty.", nameof(key));

        (Key, Value) = (key, value);
    }

    public string Key { get; }
    public object? Value { get; }

    public static DaisyClawTelemetryTag String(DaisyClawTelemetryTagKey key, string? value) =>
        new(key, value);

    public static DaisyClawTelemetryTag String(string localKey, string? value) =>
        new(localKey, value);

    public static DaisyClawTelemetryTag Bool(DaisyClawTelemetryTagKey key, bool value) =>
        new(key, value);

    public static DaisyClawTelemetryTag Bool(string localKey, bool value) =>
        new(localKey, value);

    public static DaisyClawTelemetryTag Number(DaisyClawTelemetryTagKey key, long value) =>
        new(key, value);

    public static DaisyClawTelemetryTag Number(string localKey, long value) =>
        new(localKey, value);
}
