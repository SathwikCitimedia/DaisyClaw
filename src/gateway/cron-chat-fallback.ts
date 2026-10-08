// Scheduled-run results that reached no one, posted into the Daisy chat.
//
// A job set to "announce" sends its result to a chat app. Someone who only uses
// the Daisy app has none, so results and failure alerts used to be dropped and
// the only sign of a run was a red "error" on the Jobs page. Posting into the
// chat also raises the tray's Windows notification, which listens for chat
// replies.
import { resolveAgentMainSessionKey } from "../config/sessions/main-session.js";
import { appendAssistantMessageToSessionTranscript } from "../config/sessions/transcript.js";
import type { DaisyClawConfig } from "../config/types.daisyclaw.js";
import { resolveCronDeliveryPlan } from "../cron/delivery-plan.js";
import type { CronEvent } from "../cron/service.js";
import type { CronJob } from "../cron/types.js";

type ChatBroadcast = (event: string, payload: unknown, opts?: { dropIfSlow?: boolean }) => void;

/** Plain words for the errors a scheduled run reports in engine terms. */
export function describeCronRunError(error: string | undefined): string {
  const text = (error ?? "").trim();
  if (!text) {
    return "Something went wrong and the run stopped.";
  }
  if (/setup timed out before runner start|stalled before execution start/i.test(text)) {
    return "Daisy couldn't get started in time, so this run was stopped.";
  }
  if (/job execution timed out/i.test(text)) {
    return "The task took longer than its time limit, so it was stopped.";
  }
  const firstLine = text.split("\n")[0] ?? text;
  return firstLine.length > 300 ? `${firstLine.slice(0, 299)}…` : firstLine;
}

/** True when a finished run's result was meant for the user but reached no one. */
export function isUndeliveredCronRun(evt: CronEvent, job: CronJob | undefined): job is CronJob {
  if (evt.action !== "finished" || !job || job.payload.kind !== "agentTurn") {
    return false;
  }
  // Main-session jobs already run in the chat, so their output is there.
  if (job.sessionTarget === "main") {
    return false;
  }
  if (evt.delivered === true || evt.deliveryStatus === "not-requested") {
    return false;
  }
  const plan = resolveCronDeliveryPlan(job);
  if (!plan.requested) {
    return false;
  }
  if (evt.status === "ok") {
    return Boolean(evt.summary?.trim());
  }
  return evt.status === "error";
}

function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** The chat message for a run that reached no one. */
export function formatCronRunChatMessage(evt: CronEvent, job: CronJob): string {
  const when = formatClock(evt.runAtMs ?? Date.now());
  if (evt.status === "ok") {
    return `**Scheduled task · ${job.name}** · ${when}\n\n${evt.summary?.trim() ?? ""}`;
  }
  const next =
    typeof evt.nextRunAtMs === "number" && job.enabled !== false
      ? `\n\nNext run: ${formatClock(evt.nextRunAtMs)}.`
      : "";
  return `**Scheduled task · ${job.name}** didn't finish · ${when}\n\n${describeCronRunError(evt.error)}${next}`;
}

/**
 * The chat a job's results belong in: the one it was made from, or else the
 * agent's main chat.
 */
function resolveResultSessionKey(job: CronJob, agentId: string, cfg: DaisyClawConfig): string {
  const own = job.sessionKey?.trim();
  if (own?.startsWith("agent:")) {
    return own;
  }
  return resolveAgentMainSessionKey({ cfg, agentId });
}

/** Posts a run's result, or why it stopped, into the chat when nothing else carried it. */
export async function postUndeliveredCronRunToChat(params: {
  evt: CronEvent;
  job: CronJob | undefined;
  resolveCronAgent: (requested?: string | null) => { agentId: string; cfg: DaisyClawConfig };
  broadcast: ChatBroadcast;
}): Promise<void> {
  const { evt, job } = params;
  if (!isUndeliveredCronRun(evt, job)) {
    return;
  }
  const { agentId, cfg } = params.resolveCronAgent(job.agentId);
  const sessionKey = resolveResultSessionKey(job, agentId, cfg);
  const text = formatCronRunChatMessage(evt, job);
  const runKey = `${job.id}:${evt.runAtMs ?? evt.runId ?? "run"}`;
  const appended = await appendAssistantMessageToSessionTranscript({
    agentId,
    sessionKey,
    text,
    idempotencyKey: `cron-run:${runKey}`,
    config: cfg,
  });
  if (!appended.ok) {
    throw new Error(`could not post scheduled run result to chat: ${appended.reason}`);
  }
  params.broadcast("chat", {
    runId: `cron-${runKey}`,
    sessionKey,
    seq: 0,
    state: "final",
    message: {
      role: "assistant",
      content: [{ type: "text", text }],
      timestamp: Date.now(),
      id: appended.messageId,
    },
  });
}
