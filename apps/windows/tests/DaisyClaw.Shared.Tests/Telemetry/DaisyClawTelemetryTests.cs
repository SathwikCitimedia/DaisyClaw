using System.Collections.Concurrent;
using System.Diagnostics;
using System.Diagnostics.Metrics;
using DaisyClaw.Shared.Telemetry;

namespace DaisyClaw.Shared.Tests.Telemetry;

public sealed class DaisyClawTelemetryTests
{
    [Fact]
    public void Constants_AreStable()
    {
        Assert.Equal("daisyclaw", DaisyClawActivitySourceName.DaisyClaw.ToTelemetryName());
        Assert.Equal("daisyclaw", DaisyClawActivitySources.DaisyClawSource.Name);
        Assert.Equal("daisyclaw", DaisyClawMeterName.DaisyClaw.ToTelemetryName());
        Assert.Equal("daisyclaw", DaisyClawMeters.DaisyClawMeter.Name);
        Assert.Equal("daisyclaw-windows-tray", DaisyClawResourceName.WindowsTray.ToServiceName());
        Assert.Equal("daisyclaw-windows", DaisyClawResourceName.WindowsNode.ToServiceName());
        Assert.Equal("daisyclaw.source", DaisyClawTelemetryTagKey.Source.ToTelemetryName());
        Assert.Equal("daisyclaw.outcome", DaisyClawTelemetryTagKey.Outcome.ToTelemetryName());
        Assert.Equal("daisyclaw.error.category", DaisyClawTelemetryTagKey.ErrorCategory.ToTelemetryName());
        Assert.Equal("daisyclaw.reason", DaisyClawTelemetryTagKey.Reason.ToTelemetryName());
        Assert.Equal("daisyclaw.status", DaisyClawTelemetryTagKey.Status.ToTelemetryName());
        Assert.Equal("error.type", DaisyClawTelemetryTagKey.ErrorType.ToTelemetryName());
        Assert.Equal("daisyclaw.protocol.client", DaisyClawTelemetryTagKey.ClientProtocol.ToTelemetryName());
        Assert.Equal("daisyclaw.protocol.gateway", DaisyClawTelemetryTagKey.GatewayProtocol.ToTelemetryName());
        Assert.Equal(
            "daisyclaw.protocol.compatibility",
            DaisyClawTelemetryTagKey.ProtocolCompatibility.ToTelemetryName());
    }

    [Fact]
    public void Trace_NoListener_RunsActionAndReturnsResult()
    {
        var ran = false;

        var result = DaisyClawTelemetry.Trace(
            "test.no_listener",
            () =>
            {
                ran = true;
                return 42;
            });

        Assert.True(ran);
        Assert.Equal(42, result);
    }

    [Fact]
    public void MarkHelpers_AreSafeForNullActivities()
    {
        var exception = new InvalidOperationException("boom");

        DaisyClawTelemetry.MarkSuccess(null);
        DaisyClawTelemetry.MarkCanceled(null);
        DaisyClawTelemetry.MarkFailure(null, exception);
    }

    [Fact]
    public void StartActivity_WithListener_AllowsManualMarking()
    {
        using var collector = ActivityCollector.Listen(
            DaisyClawActivitySourceName.DaisyClaw.ToTelemetryName(),
            "test.manual");
        using var activity = DaisyClawTelemetry.StartActivity(
            "test.manual",
            [DaisyClawTelemetryTag.String(DaisyClawTelemetryTagKey.Source, "unit-test")]);

        DaisyClawTelemetry.MarkSuccess(activity);

        Assert.NotNull(activity);
        Assert.Equal(ActivityStatusCode.Ok, activity.Status);
        Assert.Contains(activity.Tags, tag => tag.Key == DaisyClawTelemetryTagKey.Source.ToTelemetryName() && tag.Value == "unit-test");
        Assert.Contains(activity.Tags, tag => tag.Key == DaisyClawTelemetryTagKey.Outcome.ToTelemetryName() && tag.Value == "success");
    }

    [Fact]
    public void StartDetachedActivity_PreservesAmbientActivity()
    {
        using var collector = ActivityCollector.Listen(
            DaisyClawActivitySourceName.DaisyClaw.ToTelemetryName(),
            "test.detached");
        using var parent = new Activity("parent").Start();

        using var detached = DaisyClawTelemetry.StartDetachedActivity("test.detached");

        Assert.NotNull(detached);
        Assert.Same(parent, Activity.Current);
    }

    [Fact]
    public void StartDetachedActivity_WithExplicitParent_CreatesChildAndPreservesAmbientActivity()
    {
        using var collector = ActivityCollector.Listen(
            DaisyClawActivitySourceName.DaisyClaw.ToTelemetryName(),
            "test.parent",
            "test.child");
        using var ambient = new Activity("ambient").Start();
        using var parent = DaisyClawTelemetry.StartDetachedActivity("test.parent");

        using var child = DaisyClawTelemetry.StartDetachedActivity("test.child", parent!.Context);

        Assert.NotNull(child);
        Assert.Equal(parent.TraceId, child.TraceId);
        Assert.Equal(parent.SpanId, child.ParentSpanId);
        Assert.Same(ambient, Activity.Current);
    }

    [Fact]
    public void StartDetachedActivity_WithEmptyExplicitParent_CreatesRootAndPreservesAmbientActivity()
    {
        using var collector = ActivityCollector.Listen(
            DaisyClawActivitySourceName.DaisyClaw.ToTelemetryName(),
            "test.root");
        using var ambient = new Activity("ambient").Start();

        using var root = DaisyClawTelemetry.StartDetachedActivity(
            "test.root",
            default(ActivityContext));

        Assert.NotNull(root);
        Assert.Equal(default, root.ParentSpanId);
        Assert.NotEqual(ambient.TraceId, root.TraceId);
        Assert.Same(ambient, Activity.Current);
    }

    [Fact]
    public void StopDetachedActivity_PreservesNewerAmbientActivity()
    {
        using var collector = ActivityCollector.Listen(
            DaisyClawActivitySourceName.DaisyClaw.ToTelemetryName(),
            "test.detached");
        using var original = new Activity("original").Start();
        var detached = DaisyClawTelemetry.StartDetachedActivity("test.detached");
        using var newer = new Activity("newer").Start();

        DaisyClawTelemetry.StopDetachedActivity(detached);

        Assert.NotNull(detached);
        Assert.True(detached!.IsStopped);
        Assert.Same(newer, Activity.Current);
    }

    [Fact]
    public void StopDetachedActivity_WithNull_IsSafe()
    {
        using var ambient = new Activity("ambient").Start();

        DaisyClawTelemetry.StopDetachedActivity(null);

        Assert.Same(ambient, Activity.Current);
    }

    [Fact]
    public void Trace_WithListener_RecordsSuccessAndTags()
    {
        using var collector = ActivityCollector.Listen(
            DaisyClawActivitySourceName.DaisyClaw.ToTelemetryName(),
            "test.success");

        DaisyClawTelemetry.Trace(
            "test.success",
            () => { },
            [
                DaisyClawTelemetryTag.String(DaisyClawTelemetryTagKey.Source, "unit-test"),
                DaisyClawTelemetryTag.String("daisyclaw.test.exporter", "tray-otel")
            ]);

        var activity = Assert.Single(collector.Stopped);
        Assert.Equal("test.success", activity.OperationName);
        Assert.Equal(ActivityStatusCode.Ok, activity.Status);
        Assert.Contains(activity.Tags, tag => tag.Key == DaisyClawTelemetryTagKey.Source.ToTelemetryName() && tag.Value == "unit-test");
        Assert.Contains(activity.Tags, tag => tag.Key == "daisyclaw.test.exporter" && tag.Value == "tray-otel");
        Assert.Contains(activity.Tags, tag => tag.Key == DaisyClawTelemetryTagKey.Outcome.ToTelemetryName() && tag.Value == "success");
    }

    [Fact]
    public void Trace_Exception_MarksErrorAndRethrowsOriginal()
    {
        using var collector = ActivityCollector.Listen(
            DaisyClawActivitySourceName.DaisyClaw.ToTelemetryName(),
            "test.error");
        var expected = new InvalidOperationException("boom");

        var thrown = Assert.Throws<InvalidOperationException>(() =>
            DaisyClawTelemetry.Trace("test.error", () => throw expected));

        Assert.Same(expected, thrown);
        var activity = Assert.Single(collector.Stopped);
        Assert.Equal(ActivityStatusCode.Error, activity.Status);
        Assert.Equal(nameof(InvalidOperationException), activity.StatusDescription);
        Assert.Contains(activity.Tags, tag => tag.Key == DaisyClawTelemetryTagKey.Outcome.ToTelemetryName() && tag.Value == "failure");
        Assert.Contains(
            activity.Tags,
            tag => tag.Key == DaisyClawTelemetryTagKey.ErrorType.ToTelemetryName() && tag.Value == typeof(InvalidOperationException).FullName);
    }

    [Fact]
    public async Task TraceAsync_WithListener_RecordsSuccessAndReturnsResult()
    {
        using var collector = ActivityCollector.Listen(
            DaisyClawActivitySourceName.DaisyClaw.ToTelemetryName(),
            "test.async.success");

        var result = await DaisyClawTelemetry.TraceAsync(
            "test.async.success",
            _ => Task.FromResult("ok"));

        Assert.Equal("ok", result);
        var activity = Assert.Single(collector.Stopped);
        Assert.Equal("test.async.success", activity.OperationName);
        Assert.Equal(ActivityStatusCode.Ok, activity.Status);
        Assert.Contains(activity.Tags, tag => tag.Key == DaisyClawTelemetryTagKey.Outcome.ToTelemetryName() && tag.Value == "success");
    }

    [Fact]
    public async Task TraceAsync_CanceledTask_MarksCanceledAndPreservesCancellation()
    {
        using var collector = ActivityCollector.Listen(
            DaisyClawActivitySourceName.DaisyClaw.ToTelemetryName(),
            "test.async.cancel");
        using var cts = new CancellationTokenSource();
        await cts.CancelAsync();

        await Assert.ThrowsAsync<TaskCanceledException>(() =>
            DaisyClawTelemetry.TraceAsync(
                "test.async.cancel",
                token => Task.FromCanceled(token),
                cancellationToken: cts.Token));

        var activity = Assert.Single(collector.Stopped);
        Assert.Equal(ActivityStatusCode.Unset, activity.Status);
        Assert.Contains(activity.Tags, tag => tag.Key == DaisyClawTelemetryTagKey.Outcome.ToTelemetryName() && tag.Value == "canceled");
    }

    [Fact]
    public void Trace_OperationCanceled_MarksCanceledAndRethrowsOriginal()
    {
        using var collector = ActivityCollector.Listen(
            DaisyClawActivitySourceName.DaisyClaw.ToTelemetryName(),
            "test.sync.cancel");
        var expected = new OperationCanceledException();

        var thrown = Assert.Throws<OperationCanceledException>(() =>
            DaisyClawTelemetry.Trace("test.sync.cancel", () => throw expected));

        Assert.Same(expected, thrown);
        var activity = Assert.Single(collector.Stopped);
        Assert.Equal(ActivityStatusCode.Unset, activity.Status);
        Assert.Contains(activity.Tags, tag => tag.Key == DaisyClawTelemetryTagKey.Outcome.ToTelemetryName() && tag.Value == "canceled");
    }

    [Fact]
    public void StringTag_PreservesStringValues()
    {
        const string value = "diagnostic-label";

        var tag = DaisyClawTelemetryTag.String(DaisyClawTelemetryTagKey.Source, value);

        Assert.Equal(value, tag.Value);
    }

    [Fact]
    public void LocalStringTag_UsesLocalKey()
    {
        var tag = DaisyClawTelemetryTag.String("daisyclaw.test.local", "value");

        Assert.Equal("daisyclaw.test.local", tag.Key);
        Assert.Equal("value", tag.Value);
    }

    [Fact]
    public void TelemetryTag_IsReferenceType_WithValidatedConstruction()
    {
        Assert.False(typeof(DaisyClawTelemetryTag).IsValueType);
        Assert.Throws<ArgumentOutOfRangeException>(() => new DaisyClawTelemetryTag((DaisyClawTelemetryTagKey)999, "value"));
        Assert.Throws<ArgumentException>(() => DaisyClawTelemetryTag.String("", "value"));
    }

    [Fact]
    public void CounterMetric_WithListener_RecordsMeasurementAndTags()
    {
        var metricName = $"test.counter.{Guid.NewGuid():N}";
        using var collector = MetricCollector.Listen(DaisyClawMeterName.DaisyClaw.ToTelemetryName());
        var counter = DaisyClawTelemetry.CreateCounter(metricName, unit: "{event}");

        DaisyClawTelemetry.Add(
            counter,
            2,
            [
                DaisyClawTelemetryTag.String(DaisyClawTelemetryTagKey.Source, "unit-test"),
                DaisyClawTelemetryTag.Number("daisyclaw.test.count", 7)
            ]);

        var measurement = Assert.Single(collector.LongMeasurements, m => m.Name == metricName);
        Assert.Equal(2, measurement.Value);
        Assert.Contains(measurement.Tags, tag => tag.Key == DaisyClawTelemetryTagKey.Source.ToTelemetryName() && (string?)tag.Value == "unit-test");
        Assert.Contains(measurement.Tags, tag => tag.Key == "daisyclaw.test.count" && (long)tag.Value! == 7);
    }

    [Fact]
    public void HistogramMetric_WithListener_RecordsMeasurementAndTags()
    {
        var metricName = $"test.histogram.{Guid.NewGuid():N}";
        using var collector = MetricCollector.Listen(DaisyClawMeterName.DaisyClaw.ToTelemetryName());
        var histogram = DaisyClawTelemetry.CreateHistogram(metricName, unit: "ms");

        DaisyClawTelemetry.Record(
            histogram,
            42.5,
            [DaisyClawTelemetryTag.String(DaisyClawTelemetryTagKey.Source, "unit-test")]);

        var measurement = Assert.Single(collector.DoubleMeasurements, m => m.Name == metricName);
        Assert.Equal(42.5, measurement.Value);
        Assert.Contains(measurement.Tags, tag => tag.Key == DaisyClawTelemetryTagKey.Source.ToTelemetryName() && (string?)tag.Value == "unit-test");
    }

    [Fact]
    public void MarkFailure_RequiresException()
    {
        Assert.Throws<ArgumentNullException>(() => DaisyClawTelemetry.MarkFailure(null, null!));
    }

    private sealed class ActivityCollector : IDisposable
    {
        private readonly ActivityListener _listener;

        private ActivityCollector(string sourceName, IReadOnlySet<string> operationNames)
        {
            _listener = new ActivityListener
            {
                ShouldListenTo = source => source.Name == sourceName,
                Sample = (ref ActivityCreationOptions<ActivityContext> options) =>
                    operationNames.Contains(options.Name)
                        ? ActivitySamplingResult.AllDataAndRecorded
                        : ActivitySamplingResult.None,
                ActivityStopped = activity =>
                {
                    if (operationNames.Contains(activity.OperationName))
                        Stopped.Enqueue(activity);
                }
            };
            ActivitySource.AddActivityListener(_listener);
        }

        public ConcurrentQueue<Activity> Stopped { get; } = new();

        public static ActivityCollector Listen(string sourceName, params string[] operationNames) =>
            new(sourceName, operationNames.ToHashSet(StringComparer.Ordinal));

        public void Dispose() => _listener.Dispose();
    }

    private sealed class MetricCollector : IDisposable
    {
        private readonly MeterListener _listener;

        private MetricCollector(string meterName)
        {
            _listener = new MeterListener
            {
                InstrumentPublished = (instrument, listener) =>
                {
                    if (instrument.Meter.Name == meterName)
                        listener.EnableMeasurementEvents(instrument);
                }
            };
            _listener.SetMeasurementEventCallback<long>((instrument, measurement, tags, _) =>
                LongMeasurements.Enqueue(new MetricMeasurement<long>(instrument.Name, measurement, tags.ToArray())));
            _listener.SetMeasurementEventCallback<double>((instrument, measurement, tags, _) =>
                DoubleMeasurements.Enqueue(new MetricMeasurement<double>(instrument.Name, measurement, tags.ToArray())));
            _listener.Start();
        }

        public ConcurrentQueue<MetricMeasurement<long>> LongMeasurements { get; } = new();
        public ConcurrentQueue<MetricMeasurement<double>> DoubleMeasurements { get; } = new();

        public static MetricCollector Listen(string meterName) => new(meterName);

        public void Dispose() => _listener.Dispose();
    }

    private sealed record MetricMeasurement<T>(
        string Name,
        T Value,
        KeyValuePair<string, object?>[] Tags);
}
