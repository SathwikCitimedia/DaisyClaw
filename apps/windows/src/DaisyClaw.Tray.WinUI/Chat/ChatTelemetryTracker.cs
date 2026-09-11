using System.Diagnostics;
using System.Diagnostics.Metrics;
using DaisyClaw.Shared.Telemetry;

namespace DaisyClawTray.Chat;

internal enum ChatTelemetryOutcome
{
    Success,
    Failure,
    Canceled,
}

internal enum ChatTurnTelemetryReason
{
    AssistantFinal,
    LifecycleEnd,
    LifecycleError,
    SendRejected,
    QueuedCanceled,
    AbortRequested,
    Reset,
    Superseded,
    Disconnected,
    Disposed,
    Other,
}

internal enum ChatAdmissionTelemetryStatus
{
    Accepted,
    Deferred,
    Rejected,
    Canceled,
    Exception,
    Other,
}

internal enum ChatHistoryTelemetrySource
{
    Initial,
    Forced,
}

internal enum ChatBackfillTelemetryReason
{
    RemoteTurn,
    ResetReconciliation,
}

internal enum ChatTerminalEventDropReason
{
    MissingRunId,
    MismatchedRunId,
}

internal enum ChatResponseOutputKind
{
    None,
    Assistant,
    Reasoning,
    Tool,
    Other,
}

internal sealed class ChatTelemetryTracker
{
    internal const string TurnSpanName = "daisyclaw.chat.turn";
    internal const string QueueWaitSpanName = "daisyclaw.chat.queue.wait";
    internal const string SendSpanName = "daisyclaw.chat.send";
    internal const string ResponseWaitSpanName = "daisyclaw.chat.response.wait";
    internal const string ResponseReceiveSpanName = "daisyclaw.chat.response.receive";
    internal const string HistoryLoadSpanName = "daisyclaw.chat.history.load";
    internal const string HistoryBackfillSpanName = "daisyclaw.chat.history.backfill";

    internal const string TurnsMetricName = "daisyclaw.chat.turns";
    internal const string TurnDurationMetricName = "daisyclaw.chat.turn.duration";
    internal const string QueueWaitDurationMetricName = "daisyclaw.chat.queue.wait.duration";
    internal const string SendAttemptsMetricName = "daisyclaw.chat.send.attempts";
    internal const string SendDurationMetricName = "daisyclaw.chat.send.duration";
    internal const string ResponseWaitDurationMetricName = "daisyclaw.chat.response.wait.duration";
    internal const string ResponseReceiveDurationMetricName = "daisyclaw.chat.response.receive.duration";
    internal const string HistoryLoadsMetricName = "daisyclaw.chat.history.loads";
    internal const string HistoryLoadDurationMetricName = "daisyclaw.chat.history.load.duration";
    internal const string HistoryBackfillsMetricName = "daisyclaw.chat.history.backfills";
    internal const string HistoryBackfillDurationMetricName = "daisyclaw.chat.history.backfill.duration";
    internal const string DroppedRemoteTurnsMetricName = "daisyclaw.chat.remote_turns.dropped";
    internal const string DroppedTerminalEventsMetricName = "daisyclaw.chat.terminal_events.dropped";

    internal const string AdmissionStatusTag = "daisyclaw.chat.admission.status";
    internal const string BackfillReasonTag = "daisyclaw.chat.backfill.reason";
    internal const string DroppedRemoteTurnReasonTag = "daisyclaw.chat.remote_turn.drop.reason";
    internal const string DroppedTerminalEventReasonTag = "daisyclaw.chat.terminal_event.drop.reason";
    internal const string FirstOutputKindTag = "daisyclaw.chat.response.first_output";

    private const string SourceLocal = "local";
    private const string SourceRemote = "remote";
    private const string MissingRunId = "missing_run_id";
    private const string MismatchedRunId = "mismatched_run_id";

    private static readonly Counter<long> Turns = DaisyClawTelemetry.CreateCounter(
        TurnsMetricName,
        unit: "{turn}",
        description: "Number of observed DaisyClaw chat turns.");
    private static readonly Histogram<double> TurnDuration = DaisyClawTelemetry.CreateHistogram(
        TurnDurationMetricName,
        unit: "ms",
        description: "Duration of observed DaisyClaw chat turns.");
    private static readonly Histogram<double> QueueWaitDuration = DaisyClawTelemetry.CreateHistogram(
        QueueWaitDurationMetricName,
        unit: "ms",
        description: "Cumulative local queue dwell for completed DaisyClaw chat turns.");
    private static readonly Counter<long> SendAttempts = DaisyClawTelemetry.CreateCounter(
        SendAttemptsMetricName,
        unit: "{attempt}",
        description: "Number of DaisyClaw chat.send RPC attempts.");
    private static readonly Histogram<double> SendDuration = DaisyClawTelemetry.CreateHistogram(
        SendDurationMetricName,
        unit: "ms",
        description: "Duration of DaisyClaw chat.send RPC attempts.");
    private static readonly Histogram<double> ResponseWaitDuration = DaisyClawTelemetry.CreateHistogram(
        ResponseWaitDurationMetricName,
        unit: "ms",
        description: "Duration from chat admission or lifecycle start to the first accepted inbound output.");
    private static readonly Histogram<double> ResponseReceiveDuration = DaisyClawTelemetry.CreateHistogram(
        ResponseReceiveDurationMetricName,
        unit: "ms",
        description: "Duration from the first accepted inbound output to terminal chat completion.");
    private static readonly Counter<long> HistoryLoads = DaisyClawTelemetry.CreateCounter(
        HistoryLoadsMetricName,
        unit: "{load}",
        description: "Number of full DaisyClaw chat history loads.");
    private static readonly Histogram<double> HistoryLoadDuration = DaisyClawTelemetry.CreateHistogram(
        HistoryLoadDurationMetricName,
        unit: "ms",
        description: "Duration of full DaisyClaw chat history loads.");
    private static readonly Counter<long> HistoryBackfills = DaisyClawTelemetry.CreateCounter(
        HistoryBackfillsMetricName,
        unit: "{backfill}",
        description: "Number of targeted DaisyClaw chat history backfills.");
    private static readonly Histogram<double> HistoryBackfillDuration = DaisyClawTelemetry.CreateHistogram(
        HistoryBackfillDurationMetricName,
        unit: "ms",
        description: "Duration of targeted DaisyClaw chat history backfills.");
    private static readonly Counter<long> DroppedRemoteTurns = DaisyClawTelemetry.CreateCounter(
        DroppedRemoteTurnsMetricName,
        unit: "{turn}",
        description: "Number of remote DaisyClaw chat turns not traced because safe correlation was unavailable.");
    private static readonly Counter<long> DroppedTerminalEvents = DaisyClawTelemetry.CreateCounter(
        DroppedTerminalEventsMetricName,
        unit: "{event}",
        description: "Number of terminal DaisyClaw chat events not applied because safe correlation was unavailable.");

    private readonly object _gate = new();
    private readonly Dictionary<string, TurnState> _turnsByMessageId = new(StringComparer.Ordinal);
    private readonly Dictionary<string, TurnState> _turnsByRunId = new(StringComparer.Ordinal);

    public void StartLocalTurn(
        string messageId,
        string threadId,
        bool queued,
        ChatRuntimeGeneration? runtimeGeneration = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(messageId);

        lock (_gate)
        {
            if (_turnsByMessageId.ContainsKey(messageId))
                return;

            var state = new TurnState(
                messageId,
                threadId,
                SourceLocal,
                DaisyClawTelemetry.StartDetachedActivity(
                    TurnSpanName,
                    default(ActivityContext),
                    [DaisyClawTelemetryTag.String(DaisyClawTelemetryTagKey.Source, SourceLocal)]),
                Stopwatch.GetTimestamp(),
                runtimeGeneration);
            if (queued)
                StartQueueSegmentLocked(state);

            _turnsByMessageId.Add(messageId, state);
        }
    }

    public void DispatchLocalTurn(string messageId, string provisionalRunId)
    {
        CompleteQueueDispatch(PrepareDispatchLocalTurn(messageId, provisionalRunId));
    }

    public QueuePhaseCompletion? PrepareDispatchLocalTurn(
        string messageId,
        string provisionalRunId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(messageId);
        ArgumentException.ThrowIfNullOrWhiteSpace(provisionalRunId);

        lock (_gate)
        {
            if (!_turnsByMessageId.TryGetValue(messageId, out var state))
                return null;

            var queueCompletion = EndQueueSegmentLocked(
                state,
                Stopwatch.GetTimestamp(),
                ChatTelemetryOutcome.Success);
            state.PendingQueueCompletion = queueCompletion;
            state.IsDispatched = true;
            BindRunLocked(state, provisionalRunId);
            return queueCompletion;
        }
    }

    public void CompleteQueueDispatch(QueuePhaseCompletion? completion) =>
        CompleteQueuePhase(completion);

    public void RequeueLocalTurn(string messageId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(messageId);

        lock (_gate)
        {
            if (!_turnsByMessageId.TryGetValue(messageId, out var state))
                return;

            RemoveRunMappingsLocked(state);
            state.IsDispatched = false;
            StartQueueSegmentLocked(state);
        }
    }

    public void BindAcceptedRun(string messageId, string? runId)
    {
        if (string.IsNullOrWhiteSpace(runId))
            return;

        lock (_gate)
        {
            if (_turnsByMessageId.TryGetValue(messageId, out var state))
                BindRunLocked(state, runId);
        }
    }

    public void ObserveAdmissionAccepted(string messageId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(messageId);
        lock (_gate)
        {
            if (_turnsByMessageId.TryGetValue(messageId, out var state))
                StartResponseWaitLocked(state);
        }
    }

    public void ObserveLifecycleStart(
        string threadId,
        string? runId,
        bool allowRemoteTurn = true,
        ChatRuntimeGeneration? runtimeGeneration = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(threadId);
        if (string.IsNullOrWhiteSpace(runId))
        {
            if (!allowRemoteTurn)
                return;

            lock (_gate)
            {
                if (_turnsByMessageId.Values.Any(
                    state => state.Source == SourceLocal &&
                        state.ThreadId == threadId &&
                        state.IsDispatched))
                {
                    return;
                }
            }

            DaisyClawTelemetry.Add(
                DroppedRemoteTurns,
                tags: [DaisyClawTelemetryTag.String(DroppedRemoteTurnReasonTag, MissingRunId)]);
            return;
        }

        lock (_gate)
        {
            if (_turnsByRunId.TryGetValue(runId, out var existing))
            {
                StartResponseWaitLocked(existing);
                return;
            }

            var pendingLocal = _turnsByMessageId.Values.FirstOrDefault(
                state => state.Source == SourceLocal &&
                    state.ThreadId == threadId &&
                    state.IsDispatched &&
                    (runtimeGeneration is null ||
                     state.RuntimeGeneration == runtimeGeneration));
            if (pendingLocal is not null)
            {
                BindRunLocked(pendingLocal, runId);
                StartResponseWaitLocked(pendingLocal);
                return;
            }
            if (!allowRemoteTurn)
                return;

            var remote = new TurnState(
                messageId: null,
                threadId,
                SourceRemote,
                DaisyClawTelemetry.StartDetachedActivity(
                    TurnSpanName,
                    default(ActivityContext),
                    [DaisyClawTelemetryTag.String(DaisyClawTelemetryTagKey.Source, SourceRemote)]),
                Stopwatch.GetTimestamp(),
                runtimeGeneration);
            BindRunLocked(remote, runId);
            StartResponseWaitLocked(remote);
        }
    }

    public bool ObserveInboundOutput(
        string threadId,
        string? runId,
        ChatResponseOutputKind outputKind)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(threadId);
        ResponsePhaseCompletion? waitCompletion;
        lock (_gate)
        {
            var state = ResolveTurnForOutputLocked(threadId, runId);
            if (state is null || state.ReceivePhase is not null)
                return false;

            if (state.WaitPhase is not { } waitPhase)
                return false;

            var now = Stopwatch.GetTimestamp();
            state.FirstOutputKind = outputKind;
            state.ResponseWaitDurationMilliseconds =
                Stopwatch.GetElapsedTime(waitPhase.StartTimestamp, now).TotalMilliseconds;
            waitCompletion = new ResponsePhaseCompletion(
                waitPhase.Activity,
                state.Source,
                outputKind,
                ChatTelemetryOutcome.Success,
                Stopwatch.GetElapsedTime(waitPhase.StartTimestamp, now));
            state.PendingWaitCompletion = waitCompletion;
            state.WaitPhase = null;

            state.ReceivePhase = StartPhase(state, ResponseReceiveSpanName, now);
        }

        CompleteResponsePhase(waitCompletion);
        return true;
    }

    public ChatTelemetryOperation? StartSendAttempt(string messageId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(messageId);

        lock (_gate)
        {
            if (!_turnsByMessageId.TryGetValue(messageId, out var state))
                return null;

            var activity = state.Activity is not null
                ? DaisyClawTelemetry.StartDetachedActivity(
                    SendSpanName,
                    state.Activity.Context,
                    [DaisyClawTelemetryTag.String(DaisyClawTelemetryTagKey.Source, SourceLocal)])
                : DaisyClawTelemetry.StartDetachedActivity(
                    SendSpanName,
                    default(ActivityContext),
                    [DaisyClawTelemetryTag.String(DaisyClawTelemetryTagKey.Source, SourceLocal)]);
            return new ChatTelemetryOperation(activity, Stopwatch.GetTimestamp());
        }
    }

    public void FinishSendAttempt(
        ChatTelemetryOperation? operation,
        ChatAdmissionTelemetryStatus status,
        ChatTelemetryOutcome outcome,
        Exception? exception = null)
    {
        if (operation is null || !operation.TryFinish())
            return;

        var tags = new[]
        {
            DaisyClawTelemetryTag.String(DaisyClawTelemetryTagKey.Outcome, ToTelemetryValue(outcome)),
            DaisyClawTelemetryTag.String(AdmissionStatusTag, ToTelemetryValue(status)),
        };
        FinishActivity(operation.Activity, outcome, tags, exception);
        DaisyClawTelemetry.Add(SendAttempts, tags: tags);
        DaisyClawTelemetry.Record(
            SendDuration,
            Stopwatch.GetElapsedTime(operation.StartTimestamp).TotalMilliseconds,
            tags);
    }

    public bool FinishByMessageId(
        string messageId,
        ChatTelemetryOutcome outcome,
        ChatTurnTelemetryReason reason)
    {
        var completion = PrepareFinishByMessageId(messageId, outcome, reason);
        return CompletePreparedTurn(completion);
    }

    public PreparedTurnCompletion? PrepareFinishByMessageId(
        string messageId,
        ChatTelemetryOutcome outcome,
        ChatTurnTelemetryReason reason)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(messageId);
        lock (_gate)
        {
            if (!_turnsByMessageId.TryGetValue(messageId, out var state))
                return null;

            var completion = PrepareTurnCompletion(state, outcome, reason);
            RemoveTurnLocked(state);
            return completion;
        }
    }

    public bool CompletePreparedTurn(PreparedTurnCompletion? completion)
    {
        if (completion is null || !completion.TryComplete())
            return false;

        FinishTurn(completion);
        return true;
    }

    public bool FinishByRunId(
        string? runId,
        ChatTelemetryOutcome outcome,
        ChatTurnTelemetryReason reason)
    {
        var completion = PrepareFinishByRunId(runId, outcome, reason);
        return CompletePreparedTurn(completion);
    }

    public PreparedTurnCompletion? PrepareFinishByRunId(
        string? runId,
        ChatTelemetryOutcome outcome,
        ChatTurnTelemetryReason reason)
    {
        if (string.IsNullOrWhiteSpace(runId))
            return null;

        lock (_gate)
        {
            if (!_turnsByRunId.TryGetValue(runId, out var state))
                return null;

            var completion = PrepareTurnCompletion(state, outcome, reason);
            RemoveTurnLocked(state);
            return completion;
        }
    }

    public bool FinishActiveTurn(
        string threadId,
        ChatTelemetryOutcome outcome,
        ChatTurnTelemetryReason reason)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(threadId);
        TurnState? state;
        lock (_gate)
        {
            var active = _turnsByRunId.Values
                .Concat(_turnsByMessageId.Values)
                .Distinct()
                .Where(candidate => candidate.ThreadId == threadId && candidate.IsDispatched)
                .Take(2)
                .ToArray();
            if (active.Length != 1)
                return false;

            state = active[0];
            RemoveTurnLocked(state);
        }

        FinishTurn(state, outcome, reason);
        return true;
    }

    public void FinishThread(
        string threadId,
        ChatTelemetryOutcome outcome,
        ChatTurnTelemetryReason reason)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(threadId);
        FinishStates(
            RemoveWhere(state => state.ThreadId == threadId),
            outcome,
            reason);
    }

    public void FinishBeforeConnectionGeneration(
        long connectionGeneration,
        ChatTelemetryOutcome outcome,
        ChatTurnTelemetryReason reason) =>
        FinishStates(
            RemoveWhere(state =>
                state.RuntimeGeneration is not { } generation ||
                generation.ConnectionGeneration < connectionGeneration),
            outcome,
            reason);

    public void FinishThreadBeforeResetGeneration(
        string threadId,
        long resetGeneration,
        ChatTelemetryOutcome outcome,
        ChatTurnTelemetryReason reason)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(threadId);
        FinishStates(
            RemoveWhere(state =>
                state.ThreadId == threadId &&
                (state.RuntimeGeneration is not { } generation ||
                 generation.ResetGeneration < resetGeneration)),
            outcome,
            reason);
    }

    public void FinishAll(ChatTelemetryOutcome outcome, ChatTurnTelemetryReason reason) =>
        FinishStates(RemoveWhere(static _ => true), outcome, reason);

    public ChatTelemetryOperation StartHistoryLoad(ChatHistoryTelemetrySource source)
    {
        var tags = new[]
        {
            DaisyClawTelemetryTag.String(DaisyClawTelemetryTagKey.Source, ToTelemetryValue(source)),
        };
        return new ChatTelemetryOperation(
            DaisyClawTelemetry.StartDetachedActivity(
                HistoryLoadSpanName,
                default(ActivityContext),
                tags),
            Stopwatch.GetTimestamp(),
            tags);
    }

    public void FinishHistoryLoad(
        ChatTelemetryOperation operation,
        ChatTelemetryOutcome outcome,
        Exception? exception = null)
    {
        if (!operation.TryFinish())
            return;

        var tags = AppendOutcome(operation.Tags, outcome);
        FinishActivity(operation.Activity, outcome, tags, exception);
        DaisyClawTelemetry.Add(HistoryLoads, tags: tags);
        DaisyClawTelemetry.Record(
            HistoryLoadDuration,
            Stopwatch.GetElapsedTime(operation.StartTimestamp).TotalMilliseconds,
            tags);
    }

    public ChatTelemetryOperation StartHistoryBackfill(ChatBackfillTelemetryReason reason)
    {
        var tags = new[]
        {
            DaisyClawTelemetryTag.String(DaisyClawTelemetryTagKey.Source, SourceRemote),
            DaisyClawTelemetryTag.String(BackfillReasonTag, ToTelemetryValue(reason)),
        };
        return new ChatTelemetryOperation(
            DaisyClawTelemetry.StartDetachedActivity(
                HistoryBackfillSpanName,
                default(ActivityContext),
                tags),
            Stopwatch.GetTimestamp(),
            tags);
    }

    public void FinishHistoryBackfill(
        ChatTelemetryOperation operation,
        ChatTelemetryOutcome outcome,
        Exception? exception = null)
    {
        if (!operation.TryFinish())
            return;

        var tags = AppendOutcome(operation.Tags, outcome);
        FinishActivity(operation.Activity, outcome, tags, exception);
        DaisyClawTelemetry.Add(HistoryBackfills, tags: tags);
        DaisyClawTelemetry.Record(
            HistoryBackfillDuration,
            Stopwatch.GetElapsedTime(operation.StartTimestamp).TotalMilliseconds,
            tags);
    }

    public void RecordDroppedTerminalEvent(ChatTerminalEventDropReason reason)
    {
        DaisyClawTelemetry.Add(
            DroppedTerminalEvents,
            tags:
            [
                DaisyClawTelemetryTag.String(
                    DroppedTerminalEventReasonTag,
                    ToTelemetryValue(reason)),
            ]);
    }

    private TurnState[] RemoveWhere(Func<TurnState, bool> predicate)
    {
        lock (_gate)
        {
            var states = _turnsByMessageId.Values
                .Concat(_turnsByRunId.Values)
                .Distinct()
                .Where(predicate)
                .ToArray();
            foreach (var state in states)
                RemoveTurnLocked(state);
            return states;
        }
    }

    private static void FinishStates(
        IEnumerable<TurnState> states,
        ChatTelemetryOutcome outcome,
        ChatTurnTelemetryReason reason)
    {
        foreach (var state in states)
            FinishTurn(state, outcome, reason);
    }

    private static void FinishTurn(
        TurnState state,
        ChatTelemetryOutcome outcome,
        ChatTurnTelemetryReason reason)
    {
        FinishTurn(PrepareTurnCompletion(state, outcome, reason));
    }

    private static PreparedTurnCompletion PrepareTurnCompletion(
        TurnState state,
        ChatTelemetryOutcome outcome,
        ChatTurnTelemetryReason reason)
    {
        var endTimestamp = Stopwatch.GetTimestamp();
        var queueCompletion = state.PendingQueueCompletion;
        if (state.QueuePhase is not null)
        {
            queueCompletion = EndQueueSegmentLocked(state, endTimestamp, outcome);
            state.PendingQueueCompletion = queueCompletion;
        }
        ResponsePhaseCompletion? pendingWaitCompletion = state.PendingWaitCompletion;
        if (state.WaitPhase is { } waitPhase)
        {
            state.ResponseWaitDurationMilliseconds =
                Stopwatch.GetElapsedTime(waitPhase.StartTimestamp, endTimestamp).TotalMilliseconds;
            pendingWaitCompletion = new ResponsePhaseCompletion(
                waitPhase.Activity,
                state.Source,
                ChatResponseOutputKind.None,
                outcome,
                Stopwatch.GetElapsedTime(waitPhase.StartTimestamp, endTimestamp));
        }
        ResponsePhaseCompletion? receiveCompletion = null;
        if (state.ReceivePhase is { } receivePhase)
        {
            state.ResponseReceiveDurationMilliseconds =
                Stopwatch.GetElapsedTime(receivePhase.StartTimestamp, endTimestamp).TotalMilliseconds;
            receiveCompletion = new ResponsePhaseCompletion(
                receivePhase.Activity,
                state.Source,
                state.FirstOutputKind,
                outcome,
                Stopwatch.GetElapsedTime(receivePhase.StartTimestamp, endTimestamp));
        }
        return new PreparedTurnCompletion(
            state.Activity,
            state.StartTimestamp,
            endTimestamp,
            state.Source,
            state.WasQueued,
            state.QueuedDurationMilliseconds,
            state.ResponseWaitStarted,
            state.ResponseWaitDurationMilliseconds,
            state.ReceivePhase is not null,
            state.ResponseReceiveDurationMilliseconds,
            state.FirstOutputKind,
            queueCompletion,
            pendingWaitCompletion,
            receiveCompletion,
            outcome,
            reason);
    }

    private static void FinishTurn(PreparedTurnCompletion completion)
    {
        CompleteQueuePhase(completion.QueueCompletion);
        CompleteResponsePhase(completion.WaitCompletion);
        CompleteResponsePhase(completion.ReceiveCompletion);
        var tags = new[]
        {
            DaisyClawTelemetryTag.String(DaisyClawTelemetryTagKey.Source, completion.Source),
            DaisyClawTelemetryTag.String(DaisyClawTelemetryTagKey.Outcome, ToTelemetryValue(completion.Outcome)),
            DaisyClawTelemetryTag.String(DaisyClawTelemetryTagKey.Reason, ToTelemetryValue(completion.Reason)),
        };
        FinishActivity(completion.Activity, completion.Outcome, tags);
        DaisyClawTelemetry.Add(Turns, tags: tags);
        DaisyClawTelemetry.Record(
            TurnDuration,
            Stopwatch.GetElapsedTime(completion.StartTimestamp, completion.EndTimestamp).TotalMilliseconds,
            [
                DaisyClawTelemetryTag.String(DaisyClawTelemetryTagKey.Source, completion.Source),
                DaisyClawTelemetryTag.String(DaisyClawTelemetryTagKey.Outcome, ToTelemetryValue(completion.Outcome)),
            ]);
        if (completion.WasQueued)
        {
            DaisyClawTelemetry.Record(
                QueueWaitDuration,
                completion.QueuedDurationMilliseconds,
                [DaisyClawTelemetryTag.String(DaisyClawTelemetryTagKey.Outcome, ToTelemetryValue(completion.Outcome))]);
        }
        if (completion.ResponseWaitStarted)
        {
            DaisyClawTelemetry.Record(
                ResponseWaitDuration,
                completion.ResponseWaitDurationMilliseconds,
                ResponseMetricTags(completion));
        }
        if (completion.ResponseReceiveStarted)
        {
            DaisyClawTelemetry.Record(
                ResponseReceiveDuration,
                completion.ResponseReceiveDurationMilliseconds,
                ResponseMetricTags(completion));
        }
    }

    private static DaisyClawTelemetryTag[] ResponseMetricTags(PreparedTurnCompletion completion) =>
    [
        DaisyClawTelemetryTag.String(DaisyClawTelemetryTagKey.Source, completion.Source),
        DaisyClawTelemetryTag.String(DaisyClawTelemetryTagKey.Outcome, ToTelemetryValue(completion.Outcome)),
        DaisyClawTelemetryTag.String(FirstOutputKindTag, ToTelemetryValue(completion.FirstOutputKind)),
    ];

    private static void StartQueueSegmentLocked(TurnState state)
    {
        if (state.QueuePhase is not null)
            return;

        var startTimestamp = Stopwatch.GetTimestamp();
        state.StartQueueSegment(
            StartPhase(state, QueueWaitSpanName, startTimestamp),
            startTimestamp);
    }

    private static QueuePhaseCompletion? EndQueueSegmentLocked(
        TurnState state,
        long endTimestamp,
        ChatTelemetryOutcome outcome)
    {
        var phase = state.EndQueueSegment(endTimestamp);
        return phase is null
            ? null
            : new QueuePhaseCompletion(
                phase.Activity,
                state.Source,
                outcome,
                Stopwatch.GetElapsedTime(phase.StartTimestamp, endTimestamp));
    }

    private static void CompleteQueuePhase(QueuePhaseCompletion? completion)
    {
        if (completion is null)
            return;

        completion.Complete(() =>
        {
            SetActivityDuration(completion.Activity, completion.Duration);
            FinishActivity(
                completion.Activity,
                completion.Outcome,
                [
                    DaisyClawTelemetryTag.String(DaisyClawTelemetryTagKey.Source, completion.Source),
                    DaisyClawTelemetryTag.String(
                        DaisyClawTelemetryTagKey.Outcome,
                        ToTelemetryValue(completion.Outcome)),
                ]);
        });
    }

    private static void CompleteResponsePhase(ResponsePhaseCompletion? completion)
    {
        if (completion is null)
            return;

        completion.Complete(() =>
        {
            SetActivityDuration(completion.Activity, completion.Duration);
            FinishActivity(
                completion.Activity,
                completion.Outcome,
                [
                    DaisyClawTelemetryTag.String(DaisyClawTelemetryTagKey.Source, completion.Source),
                    DaisyClawTelemetryTag.String(DaisyClawTelemetryTagKey.Outcome, ToTelemetryValue(completion.Outcome)),
                    DaisyClawTelemetryTag.String(FirstOutputKindTag, ToTelemetryValue(completion.FirstOutputKind)),
                ]);
        });
    }

    private static void SetActivityDuration(Activity? activity, TimeSpan duration)
    {
        if (activity is not null)
            activity.SetEndTime(activity.StartTimeUtc + duration);
    }

    private static void FinishActivity(
        Activity? activity,
        ChatTelemetryOutcome outcome,
        IEnumerable<DaisyClawTelemetryTag> tags,
        Exception? exception = null)
    {
        if (activity is null)
            return;

        foreach (var tag in tags)
            activity.SetTag(tag.Key, tag.Value);

        switch (outcome)
        {
            case ChatTelemetryOutcome.Success:
                activity.SetStatus(ActivityStatusCode.Ok);
                break;
            case ChatTelemetryOutcome.Failure:
                activity.SetStatus(ActivityStatusCode.Error, exception?.GetType().Name);
                if (exception is not null)
                {
                    activity.SetTag(
                        DaisyClawTelemetryTagKey.ErrorType.ToTelemetryName(),
                        exception.GetType().FullName);
                }
                break;
            case ChatTelemetryOutcome.Canceled:
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(outcome), outcome, "Unknown chat telemetry outcome.");
        }

        DaisyClawTelemetry.StopDetachedActivity(activity);
    }

    private static DaisyClawTelemetryTag[] AppendOutcome(
        IReadOnlyList<DaisyClawTelemetryTag> tags,
        ChatTelemetryOutcome outcome) =>
        [.. tags, DaisyClawTelemetryTag.String(DaisyClawTelemetryTagKey.Outcome, ToTelemetryValue(outcome))];

    private void BindRunLocked(TurnState state, string runId)
    {
        state.RunIds.Add(runId);
        _turnsByRunId[runId] = state;
    }

    private static void StartResponseWaitLocked(TurnState state)
    {
        if (state.ResponseWaitStarted)
            return;

        state.ResponseWaitStarted = true;
        state.WaitPhase = StartPhase(
            state,
            ResponseWaitSpanName,
            Stopwatch.GetTimestamp());
    }

    private static TimedPhase StartPhase(
        TurnState state,
        string spanName,
        long startTimestamp)
    {
        var tags = new[]
        {
            DaisyClawTelemetryTag.String(DaisyClawTelemetryTagKey.Source, state.Source),
        };
        var activity = state.Activity is not null
            ? DaisyClawTelemetry.StartDetachedActivity(spanName, state.Activity.Context, tags)
            : DaisyClawTelemetry.StartDetachedActivity(spanName, default(ActivityContext), tags);
        return new TimedPhase(activity, startTimestamp);
    }

    private TurnState? ResolveTurnForOutputLocked(string threadId, string? runId)
    {
        if (!string.IsNullOrWhiteSpace(runId))
            return _turnsByRunId.GetValueOrDefault(runId);

        var active = _turnsByRunId.Values
            .Concat(_turnsByMessageId.Values)
            .Distinct()
            .Where(candidate => candidate.ThreadId == threadId && candidate.IsDispatched)
            .Take(2)
            .ToArray();
        return active.Length == 1 ? active[0] : null;
    }

    private void RemoveTurnLocked(TurnState state)
    {
        if (state.MessageId is not null)
            _turnsByMessageId.Remove(state.MessageId);
        RemoveRunMappingsLocked(state);
    }

    private void RemoveRunMappingsLocked(TurnState state)
    {
        foreach (var runId in state.RunIds)
        {
            if (_turnsByRunId.TryGetValue(runId, out var mapped) && ReferenceEquals(mapped, state))
                _turnsByRunId.Remove(runId);
        }
        state.RunIds.Clear();
    }

    internal static string ToTelemetryValue(ChatTelemetryOutcome outcome) =>
        outcome switch
        {
            ChatTelemetryOutcome.Success => "success",
            ChatTelemetryOutcome.Failure => "failure",
            ChatTelemetryOutcome.Canceled => "canceled",
            _ => throw new ArgumentOutOfRangeException(nameof(outcome), outcome, "Unknown chat telemetry outcome."),
        };

    internal static string ToTelemetryValue(ChatTurnTelemetryReason reason) =>
        reason switch
        {
            ChatTurnTelemetryReason.AssistantFinal => "assistant_final",
            ChatTurnTelemetryReason.LifecycleEnd => "lifecycle_end",
            ChatTurnTelemetryReason.LifecycleError => "lifecycle_error",
            ChatTurnTelemetryReason.SendRejected => "send_rejected",
            ChatTurnTelemetryReason.QueuedCanceled => "queued_canceled",
            ChatTurnTelemetryReason.AbortRequested => "abort_requested",
            ChatTurnTelemetryReason.Reset => "reset",
            ChatTurnTelemetryReason.Superseded => "superseded",
            ChatTurnTelemetryReason.Disconnected => "disconnected",
            ChatTurnTelemetryReason.Disposed => "disposed",
            ChatTurnTelemetryReason.Other => "other",
            _ => "other",
        };

    internal static string ToTelemetryValue(ChatAdmissionTelemetryStatus status) =>
        status switch
        {
            ChatAdmissionTelemetryStatus.Accepted => "accepted",
            ChatAdmissionTelemetryStatus.Deferred => "deferred",
            ChatAdmissionTelemetryStatus.Rejected => "rejected",
            ChatAdmissionTelemetryStatus.Canceled => "canceled",
            ChatAdmissionTelemetryStatus.Exception => "exception",
            ChatAdmissionTelemetryStatus.Other => "other",
            _ => "other",
        };

    internal static string ToTelemetryValue(ChatHistoryTelemetrySource source) =>
        source switch
        {
            ChatHistoryTelemetrySource.Initial => "initial",
            ChatHistoryTelemetrySource.Forced => "forced",
            _ => throw new ArgumentOutOfRangeException(nameof(source), source, "Unknown chat history telemetry source."),
        };

    internal static string ToTelemetryValue(ChatBackfillTelemetryReason reason) =>
        reason switch
        {
            ChatBackfillTelemetryReason.RemoteTurn => "remote_turn",
            ChatBackfillTelemetryReason.ResetReconciliation => "reset_reconciliation",
            _ => throw new ArgumentOutOfRangeException(nameof(reason), reason, "Unknown chat backfill telemetry reason."),
        };

    internal static string ToTelemetryValue(ChatTerminalEventDropReason reason) =>
        reason switch
        {
            ChatTerminalEventDropReason.MissingRunId => MissingRunId,
            ChatTerminalEventDropReason.MismatchedRunId => MismatchedRunId,
            _ => throw new ArgumentOutOfRangeException(nameof(reason), reason, "Unknown terminal event drop reason."),
        };

    internal static string ToTelemetryValue(ChatResponseOutputKind kind) =>
        kind switch
        {
            ChatResponseOutputKind.None => "none",
            ChatResponseOutputKind.Assistant => "assistant",
            ChatResponseOutputKind.Reasoning => "reasoning",
            ChatResponseOutputKind.Tool => "tool",
            ChatResponseOutputKind.Other => "other",
            _ => "other",
        };

    private sealed class TurnState(
        string? messageId,
        string threadId,
        string source,
        Activity? activity,
        long startTimestamp,
        ChatRuntimeGeneration? runtimeGeneration)
    {
        private long? _queueSegmentStart;

        public string? MessageId { get; } = messageId;
        public string ThreadId { get; } = threadId;
        public string Source { get; } = source;
        public Activity? Activity { get; } = activity;
        public long StartTimestamp { get; } = startTimestamp;
        public ChatRuntimeGeneration? RuntimeGeneration { get; } = runtimeGeneration;
        public HashSet<string> RunIds { get; } = new(StringComparer.Ordinal);
        public bool IsDispatched { get; set; }
        public bool WasQueued { get; private set; }
        public double QueuedDurationMilliseconds { get; private set; }
        public bool ResponseWaitStarted { get; set; }
        public double ResponseWaitDurationMilliseconds { get; set; }
        public double ResponseReceiveDurationMilliseconds { get; set; }
        public ChatResponseOutputKind FirstOutputKind { get; set; }
        public TimedPhase? QueuePhase { get; private set; }
        public TimedPhase? WaitPhase { get; set; }
        public TimedPhase? ReceivePhase { get; set; }
        public QueuePhaseCompletion? PendingQueueCompletion { get; set; }
        public ResponsePhaseCompletion? PendingWaitCompletion { get; set; }

        public void StartQueueSegment(TimedPhase phase, long startTimestamp)
        {
            if (_queueSegmentStart.HasValue)
                return;
            WasQueued = true;
            _queueSegmentStart = startTimestamp;
            QueuePhase = phase;
        }

        public TimedPhase? EndQueueSegment(long endTimestamp)
        {
            if (_queueSegmentStart is not { } started)
                return null;
            QueuedDurationMilliseconds +=
                Stopwatch.GetElapsedTime(started, endTimestamp).TotalMilliseconds;
            _queueSegmentStart = null;
            var phase = QueuePhase;
            QueuePhase = null;
            return phase;
        }
    }

    private sealed record TimedPhase(Activity? Activity, long StartTimestamp);

    internal sealed class QueuePhaseCompletion(
        Activity? activity,
        string source,
        ChatTelemetryOutcome outcome,
        TimeSpan duration) : PhaseCompletion
    {
        public Activity? Activity { get; } = activity;
        public string Source { get; } = source;
        public ChatTelemetryOutcome Outcome { get; } = outcome;
        public TimeSpan Duration { get; } = duration;
    }

    internal sealed class ResponsePhaseCompletion(
        Activity? activity,
        string source,
        ChatResponseOutputKind firstOutputKind,
        ChatTelemetryOutcome outcome,
        TimeSpan duration) : PhaseCompletion
    {
        public Activity? Activity { get; } = activity;
        public string Source { get; } = source;
        public ChatResponseOutputKind FirstOutputKind { get; } = firstOutputKind;
        public ChatTelemetryOutcome Outcome { get; } = outcome;
        public TimeSpan Duration { get; } = duration;
    }

    internal abstract class PhaseCompletion
    {
        private readonly object _completionGate = new();
        private int _completionState;
        private int _completingThreadId;

        public void Complete(Action complete)
        {
            lock (_completionGate)
            {
                if (_completionState == 2)
                    return;
                if (_completionState == 1)
                {
                    if (_completingThreadId == Environment.CurrentManagedThreadId)
                        return;
                    while (_completionState != 2)
                        Monitor.Wait(_completionGate);
                    return;
                }

                _completionState = 1;
                _completingThreadId = Environment.CurrentManagedThreadId;
            }

            try
            {
                complete();
            }
            finally
            {
                lock (_completionGate)
                {
                    _completionState = 2;
                    _completingThreadId = 0;
                    Monitor.PulseAll(_completionGate);
                }
            }
        }
    }

    internal sealed class PreparedTurnCompletion(
        Activity? activity,
        long startTimestamp,
        long endTimestamp,
        string source,
        bool wasQueued,
        double queuedDurationMilliseconds,
        bool responseWaitStarted,
        double responseWaitDurationMilliseconds,
        bool responseReceiveStarted,
        double responseReceiveDurationMilliseconds,
        ChatResponseOutputKind firstOutputKind,
        QueuePhaseCompletion? queueCompletion,
        ResponsePhaseCompletion? waitCompletion,
        ResponsePhaseCompletion? receiveCompletion,
        ChatTelemetryOutcome outcome,
        ChatTurnTelemetryReason reason)
    {
        private int _completed;

        public Activity? Activity { get; } = activity;
        public long StartTimestamp { get; } = startTimestamp;
        public long EndTimestamp { get; } = endTimestamp;
        public string Source { get; } = source;
        public bool WasQueued { get; } = wasQueued;
        public double QueuedDurationMilliseconds { get; } = queuedDurationMilliseconds;
        public bool ResponseWaitStarted { get; } = responseWaitStarted;
        public double ResponseWaitDurationMilliseconds { get; } = responseWaitDurationMilliseconds;
        public bool ResponseReceiveStarted { get; } = responseReceiveStarted;
        public double ResponseReceiveDurationMilliseconds { get; } = responseReceiveDurationMilliseconds;
        public ChatResponseOutputKind FirstOutputKind { get; } = firstOutputKind;
        internal QueuePhaseCompletion? QueueCompletion { get; } = queueCompletion;
        internal ResponsePhaseCompletion? WaitCompletion { get; } = waitCompletion;
        internal ResponsePhaseCompletion? ReceiveCompletion { get; } = receiveCompletion;
        public ChatTelemetryOutcome Outcome { get; } = outcome;
        public ChatTurnTelemetryReason Reason { get; } = reason;

        public bool TryComplete() => Interlocked.Exchange(ref _completed, 1) == 0;
    }
}

internal sealed class ChatTelemetryOperation(
    Activity? activity,
    long startTimestamp,
    IReadOnlyList<DaisyClawTelemetryTag>? tags = null)
{
    private int _finished;

    public Activity? Activity { get; } = activity;
    public long StartTimestamp { get; } = startTimestamp;
    public IReadOnlyList<DaisyClawTelemetryTag> Tags { get; } = tags ?? [];

    public bool TryFinish() => Interlocked.Exchange(ref _finished, 1) == 0;
}
