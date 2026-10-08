// Turns one sentence ("every 20 min email Sam for an Atlas update,
// starting 4:05 PM") into a job the New Job form can show for review: a name,
// the task on its own, and the schedule.
//
// People describe the job, timing and all, in the task box, and the form kept
// that text as the task while its own schedule fields said something else. The
// job then ran on the wrong schedule, and each run read "every 20 min…" as an
// instruction to set up a schedule instead of doing the work.
//
// The user's model does the reading. When it cannot (no key, offline, a reply
// that is not usable) a few plain rules cover the common phrasings.
import { generateConversationLabel } from "../auto-reply/reply/conversation-label-generator.js";
import type { DaisyClawConfig } from "../config/types.daisyclaw.js";
import { computeNextRunAtMs } from "../cron/schedule.js";

export type CronDraftSchedule =
  | {
      kind: "every";
      amount: number;
      unit: "minutes" | "hours" | "days";
      /** First run, local wall-clock time "YYYY-MM-DDTHH:MM"; absent means now. */
      startAt?: string;
    }
  | { kind: "cron"; expr: string }
  | { kind: "at"; at: string };

export type CronDraft = { name: string; task: string; schedule: CronDraftSchedule };

export type CronDraftResult =
  | { ok: true; draft: CronDraft; source: "model" | "rules" }
  | { ok: false; reason: string };

const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const MODEL_TIMEOUT_MS = 15_000;
const MAX_NAME_LENGTH = 60;

function buildSystemPrompt(now: string, timeZone: string | undefined): string {
  return [
    "You turn a request for a recurring or scheduled task into a job definition.",
    `The user's local time now is ${now}${timeZone ? ` (${timeZone})` : ""}.`,
    "Reply with ONLY a JSON object, no prose, in this shape:",
    '{"name": "...", "task": "...", "schedule": {...}}',
    "- name: a short title, at most 6 words.",
    "- task: what to do on ONE run, as an instruction, with every timing word removed",
    '  (no "every 20 minutes", "until I stop", "starting at", "today"). Keep names, addresses and details.',
    "- schedule is exactly one of:",
    '  {"kind": "every", "amount": <whole number>, "unit": "minutes" | "hours" | "days", "startAt": "YYYY-MM-DDTHH:MM" or omitted}',
    '  {"kind": "cron", "expr": "<5-field cron expression in local time>"} for fixed times like "every weekday at 9am"',
    '  {"kind": "at", "at": "YYYY-MM-DDTHH:MM"} for a single run',
    "- Times are the user's local time. Resolve words like today, tomorrow and 4pm against the time above.",
    '- If the request says nothing about when, reply with {"schedule": null} and nothing else. Never guess a schedule.',
  ].join("\n");
}

function stripCodeFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "")
    .trim();
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) {
    return null;
  }
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function isValidCronExpr(expr: string): boolean {
  try {
    return computeNextRunAtMs({ kind: "cron", expr }, Date.now()) !== undefined;
  } catch {
    return false;
  }
}

/** Checks a model's schedule and keeps only what the form can hold. */
export function readDraftSchedule(value: unknown): CronDraftSchedule | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (record.kind === "every") {
    const amount = Number(record.amount);
    const unit = record.unit;
    if (!Number.isInteger(amount) || amount < 1 || amount > 10_000) {
      return null;
    }
    if (unit !== "minutes" && unit !== "hours" && unit !== "days") {
      return null;
    }
    const startAt =
      typeof record.startAt === "string" && LOCAL_DATE_TIME.test(record.startAt.trim())
        ? record.startAt.trim()
        : undefined;
    return { kind: "every", amount, unit, ...(startAt ? { startAt } : {}) };
  }
  if (record.kind === "cron" && typeof record.expr === "string") {
    const expr = record.expr.trim();
    return isValidCronExpr(expr) ? { kind: "cron", expr } : null;
  }
  if (record.kind === "at" && typeof record.at === "string" && LOCAL_DATE_TIME.test(record.at)) {
    return { kind: "at", at: record.at.trim() };
  }
  return null;
}

/** Reads a model reply into a draft, or null when it is not usable. */
export function parseModelDraft(raw: string | null | undefined): CronDraft | null {
  if (typeof raw !== "string" || !raw.trim()) {
    return null;
  }
  let parsed: unknown;
  try {
    const text = stripCodeFences(raw);
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    parsed = JSON.parse(start >= 0 && end > start ? text.slice(start, end + 1) : text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  const task = cleanText(record.task, 2_000);
  const schedule = readDraftSchedule(record.schedule);
  if (!task || !schedule) {
    return null;
  }
  return { name: cleanText(record.name, MAX_NAME_LENGTH) ?? nameFromTask(task), task, schedule };
}

function nameFromTask(task: string): string {
  const words = task
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const name = words.slice(0, 6).join(" ");
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : "Scheduled task";
}

const UNIT_WORDS: Record<string, "minutes" | "hours" | "days"> = {
  m: "minutes",
  min: "minutes",
  mins: "minutes",
  minute: "minutes",
  minutes: "minutes",
  h: "hours",
  hr: "hours",
  hrs: "hours",
  hour: "hours",
  hours: "hours",
  d: "days",
  day: "days",
  days: "days",
};

const EVERY_PATTERN = /\b(?:for\s+)?every\s+(\d+)\s*(minutes?|mins?|m|hours?|hrs?|h|days?|d)\b/i;
const EVERY_SINGLE_PATTERN = /\b(?:every\s+(minute|hour|day)|(hourly|daily))\b/i;
const CLOCK_PATTERN = /(?:@|\bat\s+|\bfrom\s+)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** "YYYY-MM-DDTHH:MM" for a local date at a given clock time. */
function localDateTime(date: Date, hours: number, minutes: number): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hours)}:${pad(minutes)}`;
}

function readClock(text: string): { hours: number; minutes: number } | null {
  const match = CLOCK_PATTERN.exec(text);
  if (!match) {
    return null;
  }
  let hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3]?.toLowerCase();
  if (hours < 1 || hours > 12 || minutes > 59) {
    return null;
  }
  if (meridiem === "pm" && hours !== 12) {
    hours += 12;
  } else if (meridiem === "am" && hours === 12) {
    hours = 0;
  }
  return { hours, minutes };
}

const TIMING_PHRASES = [
  EVERY_PATTERN,
  EVERY_SINGLE_PATTERN,
  /\b(?:until|till)\s+i\s+(?:say\s+)?stop\b/gi,
  /\b(?:and\s+)?(?:start(?:ing)?|begin(?:ning)?)\b[^,.]*?(?:@|\bat\s)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)(?:\s+(?:today|tomorrow))?/gi,
  CLOCK_PATTERN,
  /\b(?:today|tomorrow)\b/gi,
];

function stripTiming(text: string): string {
  let out = text;
  for (const pattern of TIMING_PHRASES) {
    out = out.replace(new RegExp(pattern.source, "gi"), " ");
  }
  return out
    .replace(/\s+([,.])/g, "$1")
    .replace(/(?:^|\s)[,.]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/[\s,]+$/g, "")
    .trim();
}

/** Plain rules for the common phrasings, used when the model cannot help. */
export function parseCronDraftWithRules(text: string, now: Date = new Date()): CronDraft | null {
  const source = text.replace(/\s+/g, " ").trim();
  if (!source) {
    return null;
  }
  const clock = readClock(source);
  const day = new Date(now);
  if (/\btomorrow\b/i.test(source)) {
    day.setDate(day.getDate() + 1);
  }
  let schedule: CronDraftSchedule | null = null;
  const every = EVERY_PATTERN.exec(source);
  const single = EVERY_SINGLE_PATTERN.exec(source);
  const unit = every
    ? UNIT_WORDS[every[2].toLowerCase()]
    : single
      ? UNIT_WORDS[(single[1] ?? (single[2] === "hourly" ? "hour" : "day")).toLowerCase()]
      : undefined;
  if (unit) {
    const amount = every ? Number(every[1]) : 1;
    if (unit === "days" && amount === 1 && clock) {
      schedule = { kind: "cron", expr: `${clock.minutes} ${clock.hours} * * *` };
    } else if (amount >= 1) {
      schedule = {
        kind: "every",
        amount,
        unit,
        ...(clock ? { startAt: localDateTime(day, clock.hours, clock.minutes) } : {}),
      };
    }
  } else if (clock) {
    schedule = { kind: "at", at: localDateTime(day, clock.hours, clock.minutes) };
  }
  if (!schedule) {
    return null;
  }
  const stripped = stripTiming(source);
  const task = stripped ? stripped.charAt(0).toUpperCase() + stripped.slice(1) : source;
  return { name: nameFromTask(task), task, schedule };
}

/** Drafts a job from one sentence: the user's model first, plain rules second. */
export async function draftCronJobFromText(params: {
  text: string;
  /** The viewer's local time, "YYYY-MM-DDTHH:MM", with weekday if known. */
  now: string;
  timeZone?: string;
  cfg: DaisyClawConfig;
  agentId?: string;
  generate?: typeof generateConversationLabel;
}): Promise<CronDraftResult> {
  const text = params.text.trim();
  if (!text) {
    return { ok: false, reason: "Describe what the job should do and when." };
  }
  try {
    const raw = await (params.generate ?? generateConversationLabel)({
      userMessage: text,
      prompt: buildSystemPrompt(params.now, params.timeZone),
      cfg: params.cfg,
      agentId: params.agentId,
      maxLength: 4_000,
      maxTokens: 400,
      timeoutMs: MODEL_TIMEOUT_MS,
    });
    const draft = parseModelDraft(raw);
    if (draft) {
      return { ok: true, draft, source: "model" };
    }
  } catch {
    // Fall through to the rules below.
  }
  const nowDate = LOCAL_DATE_TIME.test(params.now.slice(0, 16))
    ? new Date(`${params.now.slice(0, 16)}:00`)
    : new Date();
  const ruled = parseCronDraftWithRules(text, nowDate);
  if (ruled) {
    return { ok: true, draft: ruled, source: "rules" };
  }
  return {
    ok: false,
    reason:
      'Daisy couldn\'t tell when this should run. Try including the timing, like "every 20 minutes" or "every weekday at 9 AM".',
  };
}
