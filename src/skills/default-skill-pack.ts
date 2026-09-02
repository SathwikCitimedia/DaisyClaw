/**
 * Curated default skill pack for consumer installs.
 *
 * Bundled skills ship enabled by default, so a fresh install surfaces all 57 —
 * most of them developer/ops tools. The pack sorts them into tiers and hides
 * the advanced ones via `skills.entries.<name>.enabled: false`, which the
 * Control UI toggle can undo per skill (unlike `skills.allowBundled`, which has
 * no UI and silently keeps dead names when skills are renamed).
 */
import type { DaisyClawConfig } from "../config/types.daisyclaw.js";

/** Tier 1: useful immediately, no accounts or extra software. */
export const DEFAULT_SKILL_PACK_INSTANT = [
  "canvas",
  "daily-briefing",
  "diagram-maker",
  "meme-maker",
  "quick-notes",
  "reminders",
  "taskflow",
  "weather",
] as const;

/** Tier 2: popular consumer services; the UI's "Needs setup" flow handles keys. */
export const DEFAULT_SKILL_PACK_CONNECT = ["gog", "notion", "spotify-player", "trello"] as const;

/**
 * Already gated by their own channel/plugin/opt-in config, so they stay
 * enabled and only appear once that surface is configured.
 */
export const DEFAULT_SKILL_PACK_SELF_GATED = [
  "coding-agent",
  "discord",
  "slack",
  "voice-call",
] as const;

/** Tier 3: developer/ops/niche skills hidden by default (re-enable in the UI). */
export const DEFAULT_SKILL_PACK_HIDDEN = [
  "1password",
  "apple-notes",
  "apple-reminders",
  "bear-notes",
  "blogwatcher",
  "blucli",
  "camsnap",
  "clawhub",
  "eightctl",
  "gemini",
  "gh-issues",
  "gifgrep",
  "github",
  "goplaces",
  "healthcheck",
  "himalaya",
  "imsg",
  "mcporter",
  "model-usage",
  "nano-pdf",
  "node-connect",
  "node-inspect-debugger",
  "obsidian",
  "openai-whisper",
  "openai-whisper-api",
  "openhue",
  "oracle",
  "ordercli",
  "peekaboo",
  "python-debugpy",
  "sag",
  "session-logs",
  "sherpa-onnx-tts",
  "skill-creator",
  "songsee",
  "sonoscli",
  "spike",
  "summarize",
  "taskflow-inbox-triage",
  "things-mac",
  "tmux",
  "video-frames",
  "wacli",
  "xurl",
] as const;

/** Hidden-tier skills whose `skills.entries.<name>.enabled` is still unset. */
export function previewDefaultSkillPack(cfg: DaisyClawConfig): { toHide: string[] } {
  const entries = cfg.skills?.entries ?? {};
  const toHide = DEFAULT_SKILL_PACK_HIDDEN.filter(
    (name) => typeof entries[name]?.enabled !== "boolean",
  );
  return { toHide };
}

/**
 * Hides the pack's hidden tier without clobbering explicit user choices: only
 * skills with no `enabled` value are touched, so re-running onboarding never
 * re-hides a skill the user turned back on. Idempotent.
 */
export function applyDefaultSkillPack(cfg: DaisyClawConfig): {
  config: DaisyClawConfig;
  hidden: string[];
} {
  const { toHide } = previewDefaultSkillPack(cfg);
  if (toHide.length === 0) {
    return { config: cfg, hidden: [] };
  }
  const entries = { ...cfg.skills?.entries };
  for (const name of toHide) {
    entries[name] = { ...entries[name], enabled: false };
  }
  return {
    config: {
      ...cfg,
      skills: {
        ...cfg.skills,
        entries,
      },
    },
    hidden: toHide,
  };
}
