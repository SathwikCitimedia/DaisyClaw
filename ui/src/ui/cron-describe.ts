// Plain-language helpers for the Jobs page: the one-line preview of a job
// being created, the timing a task's own text mentions, and run errors in
// words people use.
import type { CronFormState } from "./ui-types.ts";

export type EveryInText = { amount: number; unit: CronFormState["everyUnit"] };

const EVERY_IN_TEXT = /\bevery\s+(\d+)\s*(minutes?|mins?|m|hours?|hrs?|h|days?|d)\b/i;

function unitFromWord(word: string): CronFormState["everyUnit"] {
  const lower = word.toLowerCase();
  if (lower.startsWith("h")) {
    return "hours";
  }
  if (lower.startsWith("d")) {
    return "days";
  }
  return "minutes";
}

/** The "every N minutes/hours/days" a task's own text mentions, if any. */
export function detectEveryInText(text: string): EveryInText | null {
  const match = EVERY_IN_TEXT.exec(text);
  if (!match) {
    return null;
  }
  const amount = Number(match[1]);
  if (!Number.isInteger(amount) || amount < 1) {
    return null;
  }
  return { amount, unit: unitFromWord(match[2]) };
}

export function formatEvery(amount: number, unit: CronFormState["everyUnit"]): string {
  const singular = unit.slice(0, -1);
  return amount === 1 ? `every ${singular}` : `every ${amount} ${unit}`;
}

/**
 * When the task's text names one interval and the schedule another, the job
 * runs on the schedule while its text says something else. Returns the
 * interval the text asked for, or null when they agree or the text says none.
 */
export function findScheduleMismatch(form: CronFormState): EveryInText | null {
  const said = detectEveryInText(form.payloadText);
  if (!said) {
    return null;
  }
  if (
    form.scheduleKind === "every" &&
    Number(form.everyAmount) === said.amount &&
    form.everyUnit === said.unit
  ) {
    return null;
  }
  return said;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "today 4:05 PM", "tomorrow 9:00 AM" or "Oct 8, 9:00 AM" for a local datetime value. */
export function formatLocalStart(value: string, now: Date = new Date()): string {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    return value;
  }
  const date = new Date(ms);
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const dayDiff = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
  if (dayDiff === 0) {
    return `today ${time}`;
  }
  if (dayDiff === 1) {
    return `tomorrow ${time}`;
  }
  const day = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${day}, ${time}`;
}

function formatClock(hours: number, minutes: number): string {
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Common cron shapes in words; anything else is shown as the expression. */
export function describeCronExpression(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length === 5 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    const at = formatClock(Number(hour), Number(minute));
    if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
      return `every day at ${at}`;
    }
    if (dayOfMonth === "*" && month === "*" && dayOfWeek === "1-5") {
      return `weekdays at ${at}`;
    }
  }
  return `on the schedule “${expr.trim()}”`;
}

function describeSchedule(form: CronFormState): string {
  if (form.scheduleKind === "every") {
    const amount = Number(form.everyAmount);
    const every = Number.isFinite(amount) && amount > 0 ? formatEvery(amount, form.everyUnit) : "";
    const start = form.everyStartAt ? `, starting ${formatLocalStart(form.everyStartAt)}` : "";
    return every ? `${every.charAt(0).toUpperCase()}${every.slice(1)}${start}` : "";
  }
  if (form.scheduleKind === "at") {
    return form.scheduleAt ? `Once, ${formatLocalStart(form.scheduleAt)}` : "";
  }
  const words = describeCronExpression(form.cronExpr);
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function describeResults(form: CronFormState, hasChatApps: boolean): string {
  if (form.deliveryMode === "none") {
    return "No notification";
  }
  if (form.deliveryMode === "webhook") {
    return "Results sent to your webhook";
  }
  return hasChatApps ? "Results sent to your chat app" : "Results in your Daisy chat";
}

/** One line saying what the job will do: when, what, and where results go. */
export function describeCronForm(form: CronFormState, hasChatApps: boolean): string {
  const task = form.payloadText.replace(/\s+/g, " ").trim();
  const shortTask = task.length > 90 ? `${task.slice(0, 89).trimEnd()}…` : task;
  return [describeSchedule(form), shortTask, describeResults(form, hasChatApps)]
    .filter(Boolean)
    .join(" · ");
}

/** Plain words for the errors a scheduled run reports in engine terms. */
export function describeCronRunError(error: string | undefined): string {
  const text = (error ?? "").trim();
  if (!text) {
    return "Something went wrong and the run stopped.";
  }
  if (/setup timed out before runner start|stalled before execution start/i.test(text)) {
    return "Daisy couldn't get started in time, so this run was stopped. It will try again shortly.";
  }
  if (/job execution timed out/i.test(text)) {
    return "The task took longer than its time limit, so it was stopped.";
  }
  if (/no configured channels detected/i.test(text)) {
    return "There was no chat app to send the result to.";
  }
  return text;
}
