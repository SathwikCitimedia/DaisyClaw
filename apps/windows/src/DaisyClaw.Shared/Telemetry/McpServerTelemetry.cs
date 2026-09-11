using System.Diagnostics;
using System.Diagnostics.Metrics;

namespace DaisyClaw.Shared.Telemetry;

public enum McpServerOperation
{
    Start,
    Stop
}

public enum McpServerRequestKind
{
    Probe,
    JsonRpc,
    Other
}

public enum McpServerOutcome
{
    Success,
    Failure,
    Canceled
}

public enum McpServerErrorCategory
{
    None,
    ListenerStart,
    ListenerAccept,
    ListenerStop,
    ListenerClose,
    AuthenticationFailed,
    Busy,
    Timeout,
    Shutdown,
    DrainTimeout,
    InvalidRequest,
    TransportFailure,
    InternalFailure
}

public sealed record McpServerTelemetryCompletion(
    McpServerOutcome Outcome,
    McpServerErrorCategory ErrorCategory,
    string? ErrorType,
    double DurationMilliseconds);

public static class McpServerTelemetry
{
    public const string StartSpanName = "daisyclaw.mcp.server.start";
    public const string StopSpanName = "daisyclaw.mcp.server.stop";
    public const string RequestSpanName = "daisyclaw.mcp.server.request";
    public const string LifecycleOperationsMetricName = "daisyclaw.mcp.server.lifecycle.operations";
    public const string RequestsMetricName = "daisyclaw.mcp.server.requests";
    public const string ListenerErrorsMetricName = "daisyclaw.mcp.server.listener.errors";
    public const string RequestDurationMetricName = "daisyclaw.mcp.server.request.duration";
    public const string OperationTag = "daisyclaw.mcp.server.operation";
    public const string RequestKindTag = "daisyclaw.mcp.server.request.kind";

    private static readonly Counter<long> LifecycleOperations = DaisyClawTelemetry.CreateCounter(
        LifecycleOperationsMetricName,
        unit: "{operation}",
        description: "Number of local MCP server lifecycle operations.");
    private static readonly Counter<long> Requests = DaisyClawTelemetry.CreateCounter(
        RequestsMetricName,
        unit: "{request}",
        description: "Number of local MCP HTTP requests handled.");
    private static readonly Counter<long> ListenerErrors = DaisyClawTelemetry.CreateCounter(
        ListenerErrorsMetricName,
        unit: "{error}",
        description: "Number of local MCP HTTP listener errors.");
    private static readonly Histogram<double> RequestDuration = DaisyClawTelemetry.CreateHistogram(
        RequestDurationMetricName,
        unit: "ms",
        description: "Post-accept local MCP HTTP request handling duration.");

    public static McpServerLifecycleOperation StartLifecycle(McpServerOperation operation) =>
        new(operation, LifecycleOperations);

    public static McpServerRequestOperation StartRequest(McpServerRequestKind kind) =>
        new(kind, Requests, RequestDuration);

    public static void RecordListenerError(McpServerErrorCategory errorCategory)
    {
        if (errorCategory is not (
            McpServerErrorCategory.ListenerStart or
            McpServerErrorCategory.ListenerAccept or
            McpServerErrorCategory.ListenerStop or
            McpServerErrorCategory.ListenerClose))
        {
            throw new ArgumentOutOfRangeException(
                nameof(errorCategory),
                errorCategory,
                "Listener errors require a listener error category.");
        }

        DaisyClawTelemetry.Add(
            ListenerErrors,
            tags:
            [
                DaisyClawTelemetryTag.String(
                    DaisyClawTelemetryTagKey.ErrorCategory,
                    errorCategory.ToTelemetryValue())
            ]);
    }

    internal static void ApplyTerminalTags(
        Activity? activity,
        McpServerOutcome outcome,
        McpServerErrorCategory errorCategory,
        Type? errorType)
    {
        if (activity == null)
            return;

        activity.SetTag(DaisyClawTelemetryTagKey.Outcome.ToTelemetryName(), outcome.ToTelemetryValue());
        if (errorCategory != McpServerErrorCategory.None)
        {
            activity.SetTag(
                DaisyClawTelemetryTagKey.ErrorCategory.ToTelemetryName(),
                errorCategory.ToTelemetryValue());
        }

        if (errorType != null)
            activity.SetTag(DaisyClawTelemetryTagKey.ErrorType.ToTelemetryName(), errorType.FullName);

        activity.SetStatus(outcome switch
        {
            McpServerOutcome.Success => ActivityStatusCode.Ok,
            McpServerOutcome.Failure => ActivityStatusCode.Error,
            McpServerOutcome.Canceled => ActivityStatusCode.Unset,
            _ => throw new ArgumentOutOfRangeException(
                nameof(outcome),
                outcome,
                "Unknown MCP server outcome.")
        }, outcome == McpServerOutcome.Failure ? errorType?.Name : null);
    }

    internal static DaisyClawTelemetryTag[] CreateMetricTags(
        string dimensionTag,
        string dimensionValue,
        McpServerOutcome outcome,
        McpServerErrorCategory errorCategory) =>
    [
        DaisyClawTelemetryTag.String(dimensionTag, dimensionValue),
        DaisyClawTelemetryTag.String(DaisyClawTelemetryTagKey.Outcome, outcome.ToTelemetryValue()),
        DaisyClawTelemetryTag.String(
            DaisyClawTelemetryTagKey.ErrorCategory,
            errorCategory.ToTelemetryValue())
    ];
}

public sealed class McpServerLifecycleOperation : IDisposable
{
    private readonly Activity? _activity;
    private readonly Stopwatch _stopwatch = Stopwatch.StartNew();
    private readonly Counter<long> _operations;
    private readonly McpServerOperation _operation;
    private int _completed;

    internal McpServerLifecycleOperation(
        McpServerOperation operation,
        Counter<long> operations)
    {
        _operation = operation;
        _operations = operations;
        _activity = DaisyClawTelemetry.StartDetachedActivity(
            operation == McpServerOperation.Start
                ? McpServerTelemetry.StartSpanName
                : McpServerTelemetry.StopSpanName,
            default(ActivityContext),
            [
                DaisyClawTelemetryTag.String(
                    McpServerTelemetry.OperationTag,
                    operation.ToTelemetryValue())
            ]);
    }

    public McpServerTelemetryCompletion? Complete(
        McpServerOutcome outcome,
        McpServerErrorCategory errorCategory = McpServerErrorCategory.None,
        Type? errorType = null)
    {
        if (Interlocked.Exchange(ref _completed, 1) != 0)
            return null;

        _stopwatch.Stop();
        McpServerTelemetry.ApplyTerminalTags(_activity, outcome, errorCategory, errorType);
        DaisyClawTelemetry.Add(
            _operations,
            tags: McpServerTelemetry.CreateMetricTags(
                McpServerTelemetry.OperationTag,
                _operation.ToTelemetryValue(),
                outcome,
                errorCategory));
        DaisyClawTelemetry.StopDetachedActivity(_activity);
        return new McpServerTelemetryCompletion(
            outcome,
            errorCategory,
            errorType?.FullName,
            _stopwatch.Elapsed.TotalMilliseconds);
    }

    public void Dispose() =>
        Complete(McpServerOutcome.Canceled, McpServerErrorCategory.InternalFailure);
}

public sealed class McpServerRequestOperation : IDisposable
{
    private readonly Activity? _activity;
    private readonly Stopwatch _stopwatch = Stopwatch.StartNew();
    private readonly Counter<long> _requests;
    private readonly Histogram<double> _duration;
    private readonly McpServerRequestKind _kind;
    private int _completed;

    internal McpServerRequestOperation(
        McpServerRequestKind kind,
        Counter<long> requests,
        Histogram<double> duration)
    {
        _kind = kind;
        _requests = requests;
        _duration = duration;
        _activity = DaisyClawTelemetry.StartDetachedActivity(
            McpServerTelemetry.RequestSpanName,
            default(ActivityContext),
            [
                DaisyClawTelemetryTag.String(
                    McpServerTelemetry.RequestKindTag,
                    kind.ToTelemetryValue())
            ],
            System.Diagnostics.ActivityKind.Server);
    }

    public ActivityContext Context => _activity?.Context ?? default;

    public McpServerTelemetryCompletion? Complete(
        McpServerOutcome outcome,
        McpServerErrorCategory errorCategory = McpServerErrorCategory.None,
        Type? errorType = null)
    {
        if (Interlocked.Exchange(ref _completed, 1) != 0)
            return null;

        _stopwatch.Stop();
        McpServerTelemetry.ApplyTerminalTags(_activity, outcome, errorCategory, errorType);
        var tags = McpServerTelemetry.CreateMetricTags(
            McpServerTelemetry.RequestKindTag,
            _kind.ToTelemetryValue(),
            outcome,
            errorCategory);
        DaisyClawTelemetry.Add(_requests, tags: tags);
        DaisyClawTelemetry.Record(_duration, _stopwatch.Elapsed.TotalMilliseconds, tags);
        DaisyClawTelemetry.StopDetachedActivity(_activity);
        return new McpServerTelemetryCompletion(
            outcome,
            errorCategory,
            errorType?.FullName,
            _stopwatch.Elapsed.TotalMilliseconds);
    }

    public void Dispose() =>
        Complete(McpServerOutcome.Canceled, McpServerErrorCategory.InternalFailure);
}

public static class McpServerTelemetryValues
{
    public static string ToTelemetryValue(this McpServerOperation value) =>
        value switch
        {
            McpServerOperation.Start => "start",
            McpServerOperation.Stop => "stop",
            _ => throw new ArgumentOutOfRangeException(
                nameof(value),
                value,
                "Unknown MCP server operation.")
        };

    public static string ToTelemetryValue(this McpServerRequestKind value) =>
        value switch
        {
            McpServerRequestKind.Probe => "probe",
            McpServerRequestKind.JsonRpc => "json_rpc",
            McpServerRequestKind.Other => "other",
            _ => throw new ArgumentOutOfRangeException(
                nameof(value),
                value,
                "Unknown MCP server request kind.")
        };

    public static string ToTelemetryValue(this McpServerOutcome value) =>
        value switch
        {
            McpServerOutcome.Success => "success",
            McpServerOutcome.Failure => "failure",
            McpServerOutcome.Canceled => "canceled",
            _ => throw new ArgumentOutOfRangeException(
                nameof(value),
                value,
                "Unknown MCP server outcome.")
        };

    public static string ToTelemetryValue(this McpServerErrorCategory value) =>
        value switch
        {
            McpServerErrorCategory.None => "none",
            McpServerErrorCategory.ListenerStart => "listener_start",
            McpServerErrorCategory.ListenerAccept => "listener_accept",
            McpServerErrorCategory.ListenerStop => "listener_stop",
            McpServerErrorCategory.ListenerClose => "listener_close",
            McpServerErrorCategory.AuthenticationFailed => "authentication_failed",
            McpServerErrorCategory.Busy => "busy",
            McpServerErrorCategory.Timeout => "timeout",
            McpServerErrorCategory.Shutdown => "shutdown",
            McpServerErrorCategory.DrainTimeout => "drain_timeout",
            McpServerErrorCategory.InvalidRequest => "invalid_request",
            McpServerErrorCategory.TransportFailure => "transport_failure",
            McpServerErrorCategory.InternalFailure => "internal_failure",
            _ => throw new ArgumentOutOfRangeException(
                nameof(value),
                value,
                "Unknown MCP server error category.")
        };
}
