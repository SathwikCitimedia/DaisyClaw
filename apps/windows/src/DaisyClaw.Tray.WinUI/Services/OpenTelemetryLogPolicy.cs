using Microsoft.Extensions.Logging;

namespace DaisyClawTray.Services;

internal static class OpenTelemetryLogPolicy
{
    public const string TelemetryExporterCategory = "DaisyClaw.Telemetry.Exporter";
    public const string ConnectionCategory = "DaisyClaw.Telemetry.Connection";
    public const string NodeToolCategory = "DaisyClaw.Telemetry.NodeTool";

    public static bool ShouldExport(string? category, LogLevel level) =>
        level is >= LogLevel.Information and < LogLevel.None &&
        category is TelemetryExporterCategory or ConnectionCategory or NodeToolCategory;
}
