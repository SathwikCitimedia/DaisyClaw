// Control UI view renders skills shared screen content.
import { html, nothing } from "lit";
import type { SkillStatusEntry } from "../types.ts";

export function computeSkillMissing(skill: SkillStatusEntry): string[] {
  return [
    ...skill.missing.bins.map((b) => `bin:${b}`),
    ...(skill.missing.anyBins?.length ? [`bin(any of):${skill.missing.anyBins.join(", ")}`] : []),
    ...skill.missing.env.map((e) => `env:${e}`),
    ...skill.missing.config.map((c) => `config:${c}`),
    ...skill.missing.os.map((o) => `os:${o}`),
  ];
}

/** The config path a skill uses to gate itself behind an explicit opt-in. */
export function skillSelfGatePath(skill: SkillStatusEntry): string {
  return `skills.entries.${skill.skillKey}.enabled`;
}

/** True when the skill is blocked (in part) by its own opt-in enabled flag. */
export function isSelfGateBlocked(skill: SkillStatusEntry): boolean {
  return !skill.disabled && skill.missing.config.includes(skillSelfGatePath(skill));
}

const OS_LABELS: Record<string, string> = {
  darwin: "macOS",
  macos: "macOS",
  linux: "Linux",
  win32: "Windows",
};

export type SkillSetupItem =
  | { kind: "text"; text: string }
  | { kind: "channel"; text: string; channelId: string }
  | { kind: "self-gate"; text: string };

/**
 * Friendly, actionable setup checklist for a blocked skill — replaces raw
 * `bin:`/`env:`/`config:` codes in the detail dialog.
 */
export function computeSkillSetupItems(skill: SkillStatusEntry): SkillSetupItem[] {
  const items: SkillSetupItem[] = [];
  for (const bin of skill.missing.bins) {
    items.push({ kind: "text", text: `Needs the program "${bin}" installed.` });
  }
  if (skill.missing.anyBins?.length) {
    items.push({
      kind: "text",
      text: `Needs one of these programs installed: ${skill.missing.anyBins.join(", ")}.`,
    });
  }
  for (const env of skill.missing.env) {
    items.push({ kind: "text", text: `Needs a key: ${env} — enter it below.` });
  }
  const selfGate = skillSelfGatePath(skill);
  for (const path of skill.missing.config) {
    if (path === selfGate) {
      items.push({
        kind: "self-gate",
        text: "Off by default for safety — use the toggle below to turn it on.",
      });
      continue;
    }
    const channelMatch = /^channels\.([a-z0-9-]+)(?:\.|$)/i.exec(path);
    if (channelMatch) {
      const channelId = channelMatch[1];
      items.push({
        kind: "channel",
        channelId,
        text: `Needs the ${channelId} channel connected — this skill activates automatically once it is set up.`,
      });
      continue;
    }
    const pluginMatch = /^plugins\.entries\.([a-z0-9-]+)\./i.exec(path);
    if (pluginMatch) {
      items.push({
        kind: "text",
        text: `Needs the ${pluginMatch[1]} plugin enabled in settings.`,
      });
      continue;
    }
    items.push({ kind: "text", text: `Needs configuration: ${path}.` });
  }
  for (const os of skill.missing.os) {
    items.push({ kind: "text", text: `Only available on ${OS_LABELS[os.toLowerCase()] ?? os}.` });
  }
  const missingPrograms = skill.missing.bins.length > 0 || (skill.missing.anyBins?.length ?? 0) > 0;
  if (missingPrograms && skill.install.length === 0 && skill.missing.os.length === 0) {
    items.push({
      kind: "text",
      text: "No automatic installer is available for this computer yet.",
    });
  }
  return items;
}

export function computeSkillReasons(skill: SkillStatusEntry): string[] {
  const reasons: string[] = [];
  if (skill.disabled) {
    reasons.push("disabled");
  }
  if (skill.blockedByAllowlist) {
    reasons.push("blocked by allowlist");
  }
  return reasons;
}

export function renderSkillStatusChips(params: {
  skill: SkillStatusEntry;
  showBundledBadge?: boolean;
}) {
  const skill = params.skill;
  const showBundledBadge = Boolean(params.showBundledBadge);
  return html`
    <div class="chip-row" style="margin-top: 6px;">
      <span class="chip">${skill.source}</span>
      ${showBundledBadge ? html` <span class="chip">bundled</span> ` : nothing}
      <span class="chip ${skill.eligible ? "chip-ok" : "chip-warn"}">
        ${skill.eligible ? "eligible" : "blocked"}
      </span>
      ${skill.disabled ? html` <span class="chip chip-warn">disabled</span> ` : nothing}
    </div>
  `;
}
