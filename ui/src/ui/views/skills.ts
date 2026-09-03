// Control UI view renders skills screen content.
import { html, nothing, type TemplateResult } from "lit";
import { ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { t } from "../../i18n/index.ts";
import type {
  ClawHubSkillSecurityVerdict,
  ClawHubSearchResult,
  ClawHubSkillDetail,
  SkillMessageMap,
  SkillSetupItemState,
} from "../controllers/skills.ts";
import { clawhubVerdictKey } from "../controllers/skills.ts";
import { clampText } from "../format.ts";
import { icons, type IconName } from "../icons.ts";
import { toSanitizedMarkdownHtml } from "../markdown.ts";
import { resolveSafeExternalUrl } from "../open-external-url.ts";
import { normalizeLowercaseStringOrEmpty } from "../string-coerce.ts";
import type { SkillStatusEntry, SkillStatusReport } from "../types.ts";
import { groupSkills } from "./skills-grouping.ts";
import {
  computeSkillReasons,
  computeSkillSetupItems,
  isSelfGateBlocked,
  renderSkillStatusChips,
} from "./skills-shared.ts";

// Skill cards show a consistent outline icon instead of the per-skill emoji.
// Pick by emoji category first, then by name/description keywords.
const SKILL_EMOJI_ICONS: Array<[RegExp, IconName]> = [
  [/[\u{1F512}\u{1F510}\u{1F511}\u{1F5DD}]/u, "lock"],
  [/[\u{1F4DD}\u{1F5D2}\u{1F4CB}\u{1F4C4}\u{1F4C3}]/u, "fileText"],
  [/[\u{23F0}\u{23F1}\u{23F2}\u{1F550}-\u{1F567}]/u, "clock"],
  [/[\u{1F4C5}\u{1F4C6}\u{1F5D3}]/u, "calendarClock"],
  [/[\u{1F4F7}\u{1F4F8}\u{1F3A5}\u{1F4F9}]/u, "camera"],
  [/[\u{1F3B5}\u{1F3B6}\u{1F3A7}\u{1F3BC}]/u, "music"],
  [/[\u{2709}\u{1F4E7}\u{1F4E8}\u{1F4EC}\u{1F4EE}]/u, "mail"],
  [/[\u{1F4E1}\u{1F4F0}]/u, "rss"],
  [/[\u{1F310}\u{1F30D}\u{1F30E}\u{1F30F}]/u, "globe"],
  [/[\u{1F4AC}\u{1F5E8}]/u, "messageSquare"],
  [/[\u{1F50D}\u{1F50E}]/u, "search"],
  [/[\u{1F5A5}\u{1F4BB}\u{1F5A8}]/u, "monitor"],
  [/\u{1F4F1}/u, "smartphone"],
  [/[\u{1F6E0}\u{1F527}\u{1F528}\u{2699}]/u, "wrench"],
  [/\u{26A1}/u, "zap"],
  [/\u{1F9E0}/u, "brain"],
  [/[\u{1F4DA}\u{1F4D6}]/u, "book"],
  [/[\u{1F5C4}\u{1F4BE}\u{1F5C3}]/u, "database"],
  [/\u{1F3A8}/u, "palette"],
  [/\u{1F916}/u, "bot"],
  [/[\u{1F465}\u{1F464}]/u, "users"],
  [/\u{1F5BC}/u, "image"],
  [/[\u{1F399}\u{1F3A4}]/u, "mic"],
  [/[\u{1F50A}\u{1F509}]/u, "volume2"],
  [/\u{1F4E6}/u, "archive"],
];

const SKILL_KEYWORD_ICONS: Array<[RegExp, IconName]> = [
  [/password|secret|vault|credential|auth/i, "lock"],
  [/remind|calendar|schedule/i, "calendarClock"],
  [/note|memo|journal/i, "penLine"],
  [/camera|rtsp|onvif|snapshot|photo/i, "camera"],
  [/blog|rss|feed|news/i, "rss"],
  [/music|audio|playback|sound|volume|speaker/i, "music"],
  [/mail|email|inbox/i, "mail"],
  [/chat|message|sms/i, "messageSquare"],
  [/search|find|lookup/i, "search"],
  [/browser|web|http|url|site/i, "globe"],
  [/database|sql|sqlite|postgres/i, "database"],
  [/file|document|pdf|doc/i, "fileText"],
  [/image|picture|draw|canvas|paint/i, "image"],
  [/voice|speech|transcri|mic/i, "mic"],
  [/video|screen|display|monitor/i, "monitor"],
  [/phone|mobile|device/i, "smartphone"],
  [/time|clock|timer/i, "clock"],
  [/book|read|library|docs/i, "book"],
  [/terminal|shell|cli|command/i, "terminal"],
  [/git|code|repo|dev/i, "code"],
];

function skillOutlineIcon(skill: SkillStatusEntry): TemplateResult {
  const emoji = skill.emoji ?? "";
  for (const [pattern, name] of SKILL_EMOJI_ICONS) {
    if (pattern.test(emoji)) {
      return icons[name];
    }
  }
  const haystack = `${skill.name} ${skill.description}`;
  for (const [pattern, name] of SKILL_KEYWORD_ICONS) {
    if (pattern.test(haystack)) {
      return icons[name];
    }
  }
  return icons.puzzle;
}

/** True when the skill declares darwin as its only supported platform. */
function isMacOnlySkill(skill: SkillStatusEntry): boolean {
  const os = skill.requirements.os;
  return os.length > 0 && os.every((entry) => entry === "darwin");
}

function macOnlyBadge(): TemplateResult {
  return html`
    <span
      class="skill-icon skill-icon--mac"
      title="macOS only"
      aria-label="macOS only"
      style="opacity: 0.75;"
      >${icons.apple}</span
    >
  `;
}

function safeExternalHref(raw?: string): string | null {
  if (!raw) {
    return null;
  }
  return resolveSafeExternalUrl(raw, window.location.href);
}

function showDialogWhenClosed(el?: Element) {
  if (!(el instanceof HTMLDialogElement) || el.open) {
    return;
  }
  if (el.isConnected) {
    el.showModal();
  } else {
    queueMicrotask(() => {
      if (el.isConnected && !el.open) {
        el.showModal();
      }
    });
  }
}

export type SkillsStatusFilter = "all" | "ready" | "needs-setup" | "disabled";
export type SkillDetailTab = "overview" | "card";

export type SkillsProps = {
  connected: boolean;
  loading: boolean;
  report: SkillStatusReport | null;
  error: string | null;
  filter: string;
  statusFilter: SkillsStatusFilter;
  edits: Record<string, string>;
  busyKey: string | null;
  messages: SkillMessageMap;
  detailKey: string | null;
  detailTab: SkillDetailTab;
  clawhubVerdicts: Record<string, ClawHubSkillSecurityVerdict>;
  clawhubVerdictsLoading: boolean;
  clawhubVerdictsError: string | null;
  skillCardContents: Record<string, string>;
  skillCardLoadingKey: string | null;
  skillCardErrors: Record<string, string>;
  clawhubQuery: string;
  clawhubResults: ClawHubSearchResult[] | null;
  clawhubSearchLoading: boolean;
  clawhubSearchError: string | null;
  clawhubDetail: ClawHubSkillDetail | null;
  clawhubDetailSlug: string | null;
  clawhubDetailLoading: boolean;
  clawhubDetailError: string | null;
  clawhubInstallSlug: string | null;
  clawhubInstallMessage: { kind: "success" | "error"; text: string } | null;
  clawhubAmbiguousMatches: Array<{
    ownerHandle: string;
    slug: string;
    ref: string;
    url: string;
  }> | null;
  onClawHubInstallRef: (ref: string) => void;
  onFilterChange: (next: string) => void;
  onStatusFilterChange: (next: SkillsStatusFilter) => void;
  onRefresh: () => void;
  onToggle: (skillKey: string, enabled: boolean) => void;
  onOpenChannels?: () => void;
  onFinishSetup?: () => void;
  setupItems: SkillSetupItemState[] | null;
  setupOpen: boolean;
  onSetupClose: () => void;
  onSetupRetry: (skillKey: string) => void;
  onEdit: (editKey: string, value: string) => void;
  onSaveKey: (skillKey: string, envName: string, asApiKey: boolean) => void;
  onInstall: (skillKey: string, name: string, installId: string) => void;
  onDetailOpen: (skillKey: string) => void;
  onDetailClose: () => void;
  onDetailTabChange: (tab: SkillDetailTab) => void;
  onClawHubQueryChange: (query: string) => void;
  onClawHubDetailOpen: (slug: string) => void;
  onClawHubDetailClose: () => void;
  onClawHubInstall: (slug: string) => void;
};

type StatusTabDef = { id: SkillsStatusFilter; label: string };

const STATUS_TABS: StatusTabDef[] = [
  { id: "all", label: "All" },
  { id: "ready", label: "Ready" },
  { id: "needs-setup", label: "Needs Setup" },
  { id: "disabled", label: "Disabled" },
];

function skillMatchesStatus(skill: SkillStatusEntry, status: SkillsStatusFilter): boolean {
  switch (status) {
    case "all":
      return true;
    case "ready":
      return !skill.disabled && skill.eligible;
    case "needs-setup":
      return !skill.disabled && !skill.eligible;
    case "disabled":
      return skill.disabled;
  }
  throw new Error("Unsupported skills status filter");
}

function skillStatusClass(skill: SkillStatusEntry): string {
  if (skill.disabled) {
    return "muted";
  }
  return skill.eligible ? "ok" : "warn";
}

function verdictForSkill(skill: SkillStatusEntry, verdicts: SkillsProps["clawhubVerdicts"]) {
  const link = skill.clawhub;
  if (!link || link.status !== "linked" || !link.valid) {
    return null;
  }
  return (
    verdicts[
      clawhubVerdictKey({
        registry: link.registry,
        slug: link.slug,
        version: link.installedVersion,
      })
    ] ?? null
  );
}

function verdictLabel(verdict: ClawHubSkillSecurityVerdict | null | undefined): string {
  if (!verdict) {
    return "Unavailable";
  }
  const status = verdict.securityStatus?.trim() || null;
  if (verdict.ok && verdict.decision === "pass") {
    return status === "clean" || !status ? "Clean" : status;
  }
  if (status === "pending" || status === "not-run") {
    return "Pending";
  }
  if (status === "malicious") {
    return "Blocked";
  }
  if (status === "suspicious") {
    return "Review";
  }
  return "Unavailable";
}

/** Plain-language explanation for non-passing verdicts (null when clean). */
function verdictExplanation(
  verdict: ClawHubSkillSecurityVerdict | null | undefined,
): string | null {
  if (!verdict) {
    return "Security scan result unavailable — treat this version as unverified.";
  }
  if (verdict.ok && verdict.decision === "pass") {
    return null;
  }
  const status = verdict.securityStatus?.trim() || null;
  if (status === "pending" || status === "not-run") {
    return "ClawHub hasn't finished scanning this version yet. Check back soon.";
  }
  if (status === "malicious") {
    return "ClawHub marked this version as malicious. Do not use it.";
  }
  if (status === "suspicious") {
    return "ClawHub's scanner flagged this version for manual review. Only use it if you trust the author.";
  }
  return "This version hasn't been verified clean by ClawHub yet. Only use it if you trust the author.";
}

function verdictChipClass(verdict: ClawHubSkillSecurityVerdict | null | undefined): string {
  if (!verdict) {
    return "chip-warn";
  }
  if (verdict.ok && verdict.decision === "pass") {
    return "chip-ok";
  }
  const status = verdict.securityStatus?.trim() || null;
  return status === "pending" || status === "not-run" ? "chip" : "chip-warn";
}

// Starter overview caps: enough to show the pack at a glance without
// duplicating the full grouped list underneath.
const STARTER_READY_MAX = 8;
const STARTER_CONNECT_MAX = 6;

function renderStarterOverview(props: SkillsProps, skills: SkillStatusEntry[]) {
  const ready = skills.filter((s) => !s.disabled && s.eligible);
  const connect = skills.filter((s) => s.bundled && !s.disabled && !s.eligible);
  if (ready.length === 0 && connect.length === 0) {
    return nothing;
  }
  const readyShown = ready.slice(0, STARTER_READY_MAX);
  const connectShown = connect.slice(0, STARTER_CONNECT_MAX);
  const installable = skills.filter(
    (s) =>
      !s.disabled &&
      !s.eligible &&
      s.install.length > 0 &&
      (s.missing.bins.length > 0 || (s.missing.anyBins?.length ?? 0) > 0),
  );
  return html`
    <div class="skills-starter" style="margin-top: 14px; display: grid; gap: 14px;">
      ${(() => {
        const setupRunning = (props.setupItems ?? []).some(
          (item) => item.status === "queued" || item.status === "installing",
        );
        if ((installable.length === 0 && !setupRunning) || !props.onFinishSetup) {
          return nothing;
        }
        return html`
          <div
            class="skills-finish-setup"
            style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;"
          >
            <button class="btn primary" @click=${() => props.onFinishSetup?.()}>
              ${setupRunning
                ? html`<span class="skills-setup-spinner" aria-hidden="true"></span> Setting up…`
                : `Finish setup (${installable.length})`}
            </button>
            <span class="muted" style="font-size: 13px;">
              ${setupRunning
                ? "Installs are running — click to see progress."
                : `Installs the missing programs for ${installable
                    .map((s) => s.name)
                    .join(", ")} automatically.`}
            </span>
          </div>
        `;
      })()}
      ${readyShown.length > 0
        ? html`
            <div>
              <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">Ready to use</div>
              <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                ${readyShown.map(
                  (skill) => html`
                    <button
                      class="btn btn--sm"
                      style="display: inline-flex; align-items: center; gap: 6px;"
                      title=${skill.description}
                      @click=${() => props.onDetailOpen(skill.skillKey)}
                    >
                      <span class="skill-icon" aria-hidden="true">${skillOutlineIcon(skill)}</span>
                      ${skill.name}
                    </button>
                  `,
                )}
                ${ready.length > readyShown.length
                  ? html`
                      <button
                        class="btn btn--sm"
                        @click=${() => props.onStatusFilterChange("ready")}
                      >
                        +${ready.length - readyShown.length} more
                      </button>
                    `
                  : nothing}
              </div>
            </div>
          `
        : nothing}
      ${connectShown.length > 0
        ? html`
            <div>
              <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">
                Connect to unlock
              </div>
              <div
                style="display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px;"
              >
                ${repeat(
                  connectShown,
                  (skill) => skill.skillKey,
                  (skill) => html`
                    <div
                      class="skills-starter-connect"
                      style="border: 1px solid var(--border); background: var(--panel-2); border-radius: 10px; padding: 10px 12px; display: grid; gap: 6px; align-content: start;"
                    >
                      <div
                        style="display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 13px;"
                      >
                        <span class="skill-icon" aria-hidden="true"
                          >${skillOutlineIcon(skill)}</span
                        >
                        <span>${skill.name}</span>
                      </div>
                      <div class="muted" style="font-size: 12px; line-height: 1.4;">
                        ${clampText(skill.description, 70)}
                      </div>
                      <div>
                        <button
                          class="btn btn--sm"
                          @click=${() => props.onDetailOpen(skill.skillKey)}
                        >
                          Connect
                        </button>
                      </div>
                    </div>
                  `,
                )}
              </div>
              ${connect.length > connectShown.length
                ? html`
                    <button
                      class="btn btn--sm"
                      style="margin-top: 8px;"
                      @click=${() => props.onStatusFilterChange("needs-setup")}
                    >
                      Show all (${connect.length})
                    </button>
                  `
                : nothing}
            </div>
          `
        : nothing}
    </div>
  `;
}

export function renderSkills(props: SkillsProps) {
  const skills = props.report?.skills ?? [];

  const statusCounts: Record<SkillsStatusFilter, number> = {
    all: skills.length,
    ready: 0,
    "needs-setup": 0,
    disabled: 0,
  };
  for (const s of skills) {
    if (s.disabled) {
      statusCounts.disabled++;
    } else if (s.eligible) {
      statusCounts.ready++;
    } else {
      statusCounts["needs-setup"]++;
    }
  }

  const afterStatus =
    props.statusFilter === "all"
      ? skills
      : skills.filter((s) => skillMatchesStatus(s, props.statusFilter));

  const filter = normalizeLowercaseStringOrEmpty(props.filter);
  const filtered = filter
    ? afterStatus.filter((skill) =>
        normalizeLowercaseStringOrEmpty(
          [skill.name, skill.description, skill.source].join(" "),
        ).includes(filter),
      )
    : afterStatus;
  // macOS-only skills get their own explicit group instead of mixing into the
  // source groups, so non-Mac users can tell at a glance why they're inert.
  const macOnly = filtered.filter((skill) => isMacOnlySkill(skill));
  const groups = groupSkills(filtered.filter((skill) => !isMacOnlySkill(skill)));
  if (macOnly.length > 0) {
    groups.push({ id: "macos-only", label: "macOS Only", skills: macOnly });
  }

  const detailSkill = props.detailKey
    ? (skills.find((s) => s.skillKey === props.detailKey) ?? null)
    : null;

  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">Skills</div>
          <div class="card-sub">Installed skills and their status.</div>
        </div>
        <button
          class="btn"
          ?disabled=${props.loading || !props.connected}
          @click=${props.onRefresh}
        >
          ${props.loading ? t("common.loading") : t("common.refresh")}
        </button>
      </div>

      ${props.statusFilter === "all" && !filter ? renderStarterOverview(props, skills) : nothing}

      <div class="agent-tabs" style="margin-top: 14px;">
        ${STATUS_TABS.map(
          (tab) => html`
            <button
              class="agent-tab ${props.statusFilter === tab.id ? "active" : ""}"
              @click=${() => props.onStatusFilterChange(tab.id)}
            >
              ${tab.label}<span class="agent-tab-count">${statusCounts[tab.id]}</span>
            </button>
          `,
        )}
      </div>

      <div
        class="filters"
        style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 12px;"
      >
        <label class="field" style="flex: 1; min-width: 180px;">
          <input
            .value=${props.filter}
            @input=${(e: Event) => props.onFilterChange((e.target as HTMLInputElement).value)}
            placeholder="Filter installed skills"
            autocomplete="off"
            name="skills-filter"
          />
        </label>
        <div class="muted">${filtered.length} shown</div>
      </div>

      <div style="margin-top: 16px; border-top: 1px solid var(--border); padding-top: 16px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
          <div style="font-weight: 600;">ClawHub</div>
          <div class="muted" style="font-size: 13px;">
            Search and install skills from the registry
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
          <label class="field" style="flex: 1; min-width: 180px;">
            <input
              .value=${props.clawhubQuery}
              @input=${(e: Event) =>
                props.onClawHubQueryChange((e.target as HTMLInputElement).value)}
              placeholder="Search ClawHub skills…"
              autocomplete="off"
              name="clawhub-search"
            />
          </label>
          ${props.clawhubSearchLoading ? html`<span class="muted">Searching…</span>` : nothing}
        </div>
        ${props.clawhubSearchError
          ? html`<div class="callout danger" style="margin-top: 8px;">
              ${props.clawhubSearchError}
            </div>`
          : nothing}
        ${props.clawhubInstallMessage
          ? html`<div
              class="callout ${props.clawhubInstallMessage.kind === "error" ? "danger" : "success"}"
              style="margin-top: 8px;"
            >
              ${props.clawhubInstallMessage.text}
            </div>`
          : nothing}
        ${props.clawhubAmbiguousMatches && props.clawhubAmbiguousMatches.length > 0
          ? html`<div class="callout" style="margin-top: 8px;">
              <div style="margin-bottom: 6px; font-weight: 500;">
                Multiple versions found — choose one to install:
              </div>
              ${props.clawhubAmbiguousMatches.map(
                (m) => html`
                  <button
                    class="btn btn--sm"
                    style="margin-right: 6px; margin-top: 4px;"
                    ?disabled=${props.clawhubInstallSlug !== null}
                    @click=${() => props.onClawHubInstallRef(m.ref)}
                  >
                    ${m.ref}
                  </button>
                `,
              )}
            </div>`
          : nothing}
        ${renderClawHubResults(props)}
      </div>

      ${props.error
        ? html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>`
        : nothing}
      ${filtered.length === 0
        ? html`
            <div class="muted" style="margin-top: 16px">
              ${!props.connected && !props.report
                ? "Not connected to gateway."
                : "No skills found."}
            </div>
          `
        : html`
            <div class="agent-skills-groups" style="margin-top: 16px;">
              ${groups.map((group) => {
                return html`
                  <details class="agent-skills-group" open>
                    <summary class="agent-skills-header">
                      <span style="display: inline-flex; align-items: center; gap: 6px;">
                        ${group.id === "macos-only" ? macOnlyBadge() : nothing}${group.label}
                      </span>
                      <span class="muted">${group.skills.length}</span>
                    </summary>
                    <div class="list skills-grid">
                      ${repeat(
                        group.skills,
                        (skill) => skill.skillKey,
                        (skill) => renderSkill(skill, props),
                      )}
                    </div>
                  </details>
                `;
              })}
            </div>
          `}
    </section>

    ${detailSkill ? renderSkillDetail(detailSkill, props) : nothing}
    ${props.clawhubDetailSlug ? renderClawHubDetailDialog(props) : nothing}
    ${props.setupOpen && props.setupItems ? renderSetupProgressDialog(props) : nothing}
  `;
}

function setupItemStatusView(item: SkillSetupItemState): {
  icon: TemplateResult;
  label: string;
  labelClass: string;
} {
  switch (item.status) {
    case "installing":
      return {
        icon: html`<span class="skills-setup-spinner" aria-hidden="true"></span>`,
        label: "Installing…",
        labelClass: "",
      };
    case "done":
      return {
        icon: html`<span class="statusDot ok"></span>`,
        label: "Ready",
        labelClass: "",
      };
    case "failed":
      return {
        icon: html`<span class="statusDot warn"></span>`,
        label: "Failed",
        labelClass: "",
      };
    default:
      return {
        icon: html`<span class="skill-icon" aria-hidden="true" style="opacity: 0.55;"
          >${icons.clock}</span
        >`,
        label: "Waiting",
        labelClass: "muted",
      };
  }
}

function renderSetupProgressDialog(props: SkillsProps) {
  const items = props.setupItems ?? [];
  const running = items.some((item) => item.status === "queued" || item.status === "installing");
  const doneCount = items.filter(
    (item) => item.status === "done" || item.status === "failed",
  ).length;
  const failedCount = items.filter((item) => item.status === "failed").length;
  const summary = running
    ? `${doneCount} of ${items.length} done`
    : failedCount > 0
      ? `${items.length - failedCount} ready, ${failedCount} failed`
      : `All ${items.length} ready`;

  return html`
    <dialog
      class="md-preview-dialog skills-setup-dialog"
      ${ref(showDialogWhenClosed)}
      @click=${(e: Event) => {
        const dialog = e.currentTarget as HTMLDialogElement;
        if (e.target === dialog) {
          dialog.close();
        }
      }}
      @close=${props.onSetupClose}
    >
      <div class="md-preview-dialog__panel">
        <div class="md-preview-dialog__header">
          <div class="md-preview-dialog__title">Setting up your skills</div>
          <button
            class="btn btn--sm"
            @click=${(e: Event) => {
              (e.currentTarget as HTMLElement).closest("dialog")?.close();
            }}
          >
            Close
          </button>
        </div>
        <div class="md-preview-dialog__body" style="display: grid; gap: 4px;">
          ${repeat(
            items,
            (item) => item.skillKey,
            (item) => {
              const view = setupItemStatusView(item);
              return html`
                <div
                  class="skills-setup-row"
                  style="display: flex; align-items: center; gap: 10px; padding: 8px 4px; border-bottom: 1px solid var(--border);"
                >
                  <span
                    style="display: inline-flex; width: 18px; justify-content: center;"
                    aria-hidden="true"
                    >${view.icon}</span
                  >
                  <span style="font-weight: 600; font-size: 13px;">${item.name}</span>
                  <span class="${view.labelClass}" style="font-size: 13px;">${view.label}</span>
                  ${item.status === "failed" && item.detail
                    ? html`<span
                        class="muted"
                        style="font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 40%;"
                        title=${item.detail}
                        >${item.detail}</span
                      >`
                    : nothing}
                  ${item.status === "failed"
                    ? html`
                        <button
                          class="btn btn--sm"
                          style="margin-left: auto;"
                          ?disabled=${running}
                          @click=${() => props.onSetupRetry(item.skillKey)}
                        >
                          Retry
                        </button>
                      `
                    : nothing}
                </div>
              `;
            },
          )}
          <div class="muted skills-setup-summary" style="font-size: 13px; padding-top: 10px;">
            ${summary}
          </div>
        </div>
      </div>
    </dialog>
  `;
}

function renderClawHubResults(props: SkillsProps) {
  const results = props.clawhubResults;
  if (!results) {
    return nothing;
  }
  if (results.length === 0) {
    return html`<div class="muted" style="margin-top: 8px;">No skills found on ClawHub.</div>`;
  }
  return html`
    <div class="list" style="margin-top: 8px;">
      ${results.map(
        (r) => html`
          <div
            class="list-item list-item-clickable"
            @click=${() => props.onClawHubDetailOpen(r.slug)}
          >
            <div class="list-main">
              <div class="list-title">${r.displayName}</div>
              <div class="list-sub">${r.summary ? clampText(r.summary, 120) : r.slug}</div>
            </div>
            <div class="list-meta" style="display: flex; align-items: center; gap: 8px;">
              ${r.version
                ? html`<span class="muted" style="font-size: 12px;">v${r.version}</span>`
                : nothing}
              <button
                class="btn btn--sm"
                ?disabled=${props.clawhubInstallSlug !== null}
                @click=${(e: Event) => {
                  e.stopPropagation();
                  props.onClawHubInstall(r.slug);
                }}
              >
                ${props.clawhubInstallSlug === r.slug ? "Installing\u2026" : "Install"}
              </button>
            </div>
          </div>
        `,
      )}
    </div>
  `;
}

function renderClawHubDetailDialog(props: SkillsProps) {
  const detail = props.clawhubDetail;

  return html`
    <dialog
      class="md-preview-dialog"
      ${ref(showDialogWhenClosed)}
      @click=${(e: Event) => {
        const dialog = e.currentTarget as HTMLDialogElement;
        if (e.target === dialog) {
          dialog.close();
        }
      }}
      @close=${props.onClawHubDetailClose}
    >
      <div class="md-preview-dialog__panel">
        <div class="md-preview-dialog__header">
          <div class="md-preview-dialog__title">
            ${detail?.skill?.displayName ?? props.clawhubDetailSlug}
          </div>
          <button
            class="btn btn--sm"
            @click=${(e: Event) => {
              (e.currentTarget as HTMLElement).closest("dialog")?.close();
            }}
          >
            Close
          </button>
        </div>
        <div class="md-preview-dialog__body" style="display: grid; gap: 16px;">
          ${props.clawhubDetailLoading
            ? html`<div class="muted">${t("common.loading")}</div>`
            : props.clawhubDetailError
              ? html`<div class="callout danger">${props.clawhubDetailError}</div>`
              : detail?.skill
                ? html`
                    <div style="font-size: 14px; line-height: 1.5;">
                      ${detail.skill.summary ?? ""}
                    </div>
                    ${detail.owner?.displayName
                      ? html`<div class="muted" style="font-size: 13px;">
                          By
                          ${detail.owner.displayName}${detail.owner.handle
                            ? html` (@${detail.owner.handle})`
                            : nothing}
                        </div>`
                      : nothing}
                    ${detail.latestVersion
                      ? html`<div class="muted" style="font-size: 13px;">
                          Latest: v${detail.latestVersion.version}
                        </div>`
                      : nothing}
                    ${detail.latestVersion?.changelog
                      ? html`<div
                          style="font-size: 13px; border-top: 1px solid var(--border); padding-top: 12px; white-space: pre-wrap;"
                        >
                          ${detail.latestVersion.changelog}
                        </div>`
                      : nothing}
                    ${detail.metadata?.os
                      ? html`<div class="muted" style="font-size: 12px;">
                          Platforms: ${detail.metadata.os.join(", ")}
                        </div>`
                      : nothing}
                    <button
                      class="btn primary"
                      ?disabled=${props.clawhubInstallSlug !== null}
                      @click=${() => {
                        if (props.clawhubDetailSlug) {
                          props.onClawHubInstall(props.clawhubDetailSlug);
                        }
                      }}
                    >
                      ${props.clawhubInstallSlug === props.clawhubDetailSlug
                        ? "Installing\u2026"
                        : `Install ${detail.skill.displayName}`}
                    </button>
                  `
                : html`<div class="muted">Skill not found.</div>`}
        </div>
      </div>
    </dialog>
  `;
}

function renderSkill(skill: SkillStatusEntry, props: SkillsProps) {
  const busy = props.busyKey === skill.skillKey;
  const dotClass = skillStatusClass(skill);
  const verdict = verdictForSkill(skill, props.clawhubVerdicts);

  return html`
    <div class="list-item list-item-clickable" @click=${() => props.onDetailOpen(skill.skillKey)}>
      <div class="list-main">
        <div class="list-title" style="display: flex; align-items: center; gap: 8px;">
          <span class="statusDot ${dotClass}"></span>
          <span class="skill-icon" aria-hidden="true">${skillOutlineIcon(skill)}</span>
          <span>${skill.name}</span>
          ${isMacOnlySkill(skill) ? macOnlyBadge() : nothing}
        </div>
        <div class="list-sub">${clampText(skill.description, 140)}</div>
      </div>
      <div
        class="list-meta"
        style="display: flex; align-items: center; justify-content: flex-end; gap: 10px;"
      >
        ${skill.clawhub?.status === "linked"
          ? html`<span class="chip ${verdictChipClass(verdict)}">${verdictLabel(verdict)}</span>`
          : skill.clawhub?.status === "invalid"
            ? html`<span class="chip chip-warn">ClawHub link invalid</span>`
            : nothing}
        <label class="skill-toggle-wrap" @click=${(e: Event) => e.stopPropagation()}>
          <input
            type="checkbox"
            class="skill-toggle"
            .checked=${!skill.disabled && !isSelfGateBlocked(skill)}
            ?disabled=${busy}
            @change=${(e: Event) => {
              e.stopPropagation();
              props.onToggle(skill.skillKey, skill.disabled || isSelfGateBlocked(skill));
            }}
          />
        </label>
      </div>
    </div>
  `;
}

/**
 * Stable edit-state key per (skill, env var). The primary env keeps the bare
 * skillKey so pre-existing edit state and the apiKey save path stay intact.
 */
export function skillEnvEditKey(skillKey: string, envName: string, primary: boolean): string {
  return primary ? skillKey : `${skillKey}::${envName}`;
}

/** Env vars the dialog offers inputs for: the primary key plus any missing ones. */
function skillEnvInputs(skill: SkillStatusEntry): Array<{ name: string; primary: boolean }> {
  const inputs: Array<{ name: string; primary: boolean }> = [];
  if (skill.primaryEnv) {
    inputs.push({ name: skill.primaryEnv, primary: true });
  }
  for (const name of skill.missing.env) {
    if (name !== skill.primaryEnv) {
      inputs.push({ name, primary: false });
    }
  }
  return inputs;
}

function renderSkillDetail(skill: SkillStatusEntry, props: SkillsProps) {
  const busy = props.busyKey === skill.skillKey;
  const message = props.messages[skill.skillKey] ?? null;
  const canInstall =
    skill.install.length > 0 &&
    (skill.missing.bins.length > 0 || (skill.missing.anyBins?.length ?? 0) > 0);
  const showBundledBadge = Boolean(skill.bundled && skill.source !== "daisyclaw-bundled");
  const setupItems = computeSkillSetupItems(skill);
  const selfGated = isSelfGateBlocked(skill);
  const reasons = computeSkillReasons(skill);
  const verdict = verdictForSkill(skill, props.clawhubVerdicts);
  const detailTab: SkillDetailTab =
    props.detailTab === "card" && skill.skillCard?.present ? "card" : "overview";

  return html`
    <dialog
      class="md-preview-dialog"
      ${ref(showDialogWhenClosed)}
      @click=${(e: Event) => {
        const dialog = e.currentTarget as HTMLDialogElement;
        if (e.target === dialog) {
          dialog.close();
        }
      }}
      @close=${props.onDetailClose}
    >
      <div class="md-preview-dialog__panel">
        <div class="md-preview-dialog__header">
          <div
            class="md-preview-dialog__title"
            style="display: flex; align-items: center; gap: 8px;"
          >
            <span class="statusDot ${skillStatusClass(skill)}"></span>
            <span class="skill-icon skill-icon--lg" aria-hidden="true"
              >${skillOutlineIcon(skill)}</span
            >
            <span>${skill.name}</span>
            ${isMacOnlySkill(skill) ? macOnlyBadge() : nothing}
          </div>
          <button
            class="btn btn--sm"
            @click=${(e: Event) => {
              (e.currentTarget as HTMLElement).closest("dialog")?.close();
            }}
          >
            Close
          </button>
        </div>
        <div class="md-preview-dialog__body" style="display: grid; gap: 16px;">
          <div>
            <div style="font-size: 14px; line-height: 1.5; color: var(--text);">
              ${skill.description}
            </div>
            ${renderSkillStatusChips({ skill, showBundledBadge })}
          </div>

          ${skill.clawhub || skill.skillCard?.present
            ? html`
                <div class="agent-tabs">
                  <button
                    class="agent-tab ${detailTab === "overview" ? "active" : ""}"
                    @click=${() => props.onDetailTabChange("overview")}
                  >
                    Overview
                  </button>
                  ${skill.skillCard?.present
                    ? html`<button
                        class="agent-tab ${detailTab === "card" ? "active" : ""}"
                        @click=${() => props.onDetailTabChange("card")}
                      >
                        Skill Card
                      </button>`
                    : nothing}
                </div>
              `
            : nothing}
          ${detailTab === "overview"
            ? renderInstalledClawHubOverview(skill, props, verdict)
            : renderInstalledSkillCard(skill, props)}
          ${setupItems.length > 0
            ? html`
                <div
                  class="callout skills-setup-callout"
                  style="border-color: var(--warn-subtle); background: var(--warn-subtle); color: var(--warn);"
                >
                  <div style="font-weight: 600; margin-bottom: 4px;">To finish setup</div>
                  <div style="display: grid; gap: 6px;">
                    ${setupItems.map(
                      (item) => html`
                        <div
                          style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;"
                        >
                          <span>${item.text}</span>
                          ${item.kind === "channel" && props.onOpenChannels
                            ? html`
                                <button
                                  class="btn btn--sm"
                                  @click=${(e: Event) => {
                                    (e.currentTarget as HTMLElement).closest("dialog")?.close();
                                    props.onOpenChannels?.();
                                  }}
                                >
                                  Go to Channels
                                </button>
                              `
                            : nothing}
                        </div>
                      `,
                    )}
                  </div>
                </div>
              `
            : nothing}
          ${reasons.length > 0
            ? html`
                <div class="muted" style="font-size: 13px;">Reason: ${reasons.join(", ")}</div>
              `
            : nothing}

          <div style="display: flex; align-items: center; gap: 12px;">
            <label class="skill-toggle-wrap">
              <input
                type="checkbox"
                class="skill-toggle"
                .checked=${!skill.disabled && !selfGated}
                ?disabled=${busy}
                @change=${() => props.onToggle(skill.skillKey, skill.disabled || selfGated)}
              />
            </label>
            <span style="font-size: 13px; font-weight: 500;">
              ${selfGated ? "Off (default)" : skill.disabled ? "Disabled" : "Enabled"}
            </span>
            ${canInstall
              ? html`<button
                  class="btn"
                  ?disabled=${busy}
                  @click=${() => props.onInstall(skill.skillKey, skill.name, skill.install[0].id)}
                >
                  ${busy ? "Installing\u2026" : skill.install[0].label}
                </button>`
              : nothing}
          </div>

          ${message
            ? html`<div class="callout ${message.kind === "error" ? "danger" : "success"}">
                ${message.message}
              </div>`
            : nothing}
          ${(() => {
            const envInputs = skillEnvInputs(skill);
            if (envInputs.length === 0) {
              // No key to enter here. Non-bundled (ClawHub/workspace) skills
              // usually connect accounts through an in-chat flow instead.
              return skill.bundled
                ? nothing
                : html`
                    <div class="callout skills-connect-hint" style="font-size: 13px;">
                      If this skill needs an account, connect it in chat — ask your assistant:
                      <span style="font-weight: 600;">"set up ${skill.name}"</span>.
                    </div>
                  `;
            }
            return html`
              <div style="display: grid; gap: 12px;">
                ${envInputs.map((envVar) => {
                  const editKey = skillEnvEditKey(skill.skillKey, envVar.name, envVar.primary);
                  const value = props.edits[editKey] ?? "";
                  return html`
                    <div style="display: grid; gap: 8px;">
                      <div class="field">
                        <span
                          >${envVar.primary ? "API key" : "Key"}
                          <span class="muted" style="font-weight: normal; font-size: 0.88em;"
                            >(${envVar.name})</span
                          ></span
                        >
                        <input
                          type="password"
                          .value=${value}
                          @input=${(e: Event) =>
                            props.onEdit(editKey, (e.target as HTMLInputElement).value)}
                        />
                      </div>
                      <button
                        class="btn primary"
                        style="justify-self: start;"
                        ?disabled=${busy}
                        @click=${() => props.onSaveKey(skill.skillKey, envVar.name, envVar.primary)}
                      >
                        Save ${envVar.name}
                      </button>
                    </div>
                  `;
                })}
                ${(() => {
                  const href = safeExternalHref(skill.homepage);
                  return href
                    ? html`<div class="muted" style="font-size: 13px;">
                        Get your key:
                        <a href="${href}" target="_blank" rel="noopener noreferrer"
                          >${skill.homepage}</a
                        >
                      </div>`
                    : nothing;
                })()}
              </div>
            `;
          })()}

          <div
            style="border-top: 1px solid var(--border); padding-top: 12px; display: grid; gap: 6px; font-size: 12px; color: var(--muted);"
          >
            <div><span style="font-weight: 600;">Source:</span> ${skill.source}</div>
            <div style="font-family: var(--mono); word-break: break-all;">${skill.filePath}</div>
            ${(() => {
              const safeHref = safeExternalHref(skill.homepage);
              return safeHref
                ? html`<div>
                    <a href="${safeHref}" target="_blank" rel="noopener noreferrer"
                      >${skill.homepage}</a
                    >
                  </div>`
                : nothing;
            })()}
          </div>
        </div>
      </div>
    </dialog>
  `;
}

function renderInstalledClawHubOverview(
  skill: SkillStatusEntry,
  props: SkillsProps,
  verdict: ClawHubSkillSecurityVerdict | null,
) {
  const link = skill.clawhub;
  if (!link) {
    return nothing;
  }
  if (link.status === "invalid") {
    return html`<div class="callout danger">
      <div style="font-weight: 600; margin-bottom: 4px;">ClawHub link invalid</div>
      <div>${link.reason}</div>
    </div>`;
  }
  const auditHref = safeExternalHref(verdict?.securityAuditUrl ?? undefined);
  const explanation = verdictExplanation(verdict);
  const rawReasons = verdict?.reasons?.length ? verdict.reasons.join(", ") : null;
  return html`
    <div
      class="callout"
      style="display: grid; gap: 8px; border-color: var(--border); background: var(--panel-2);"
    >
      <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
        <span class="chip ${verdictChipClass(verdict)}">${verdictLabel(verdict)}</span>
        <span class="muted" style="font-size: 12px;">${link.slug}@${link.installedVersion}</span>
        ${props.clawhubVerdictsLoading ? html`<span class="muted">Refreshing…</span>` : nothing}
      </div>
      ${props.clawhubVerdictsError
        ? html`<div class="muted" style="font-size: 13px;">${props.clawhubVerdictsError}</div>`
        : explanation
          ? html`<div class="muted" style="font-size: 13px;" title=${rawReasons ?? ""}>
              ${explanation}
            </div>`
          : nothing}
      ${auditHref
        ? html`<div style="font-size: 13px;">
            <a href="${auditHref}" target="_blank" rel="noopener noreferrer"
              >Full security report</a
            >
          </div>`
        : nothing}
    </div>
  `;
}

function renderInstalledSkillCard(skill: SkillStatusEntry, props: SkillsProps) {
  const card = skill.skillCard;
  if (!card?.present) {
    return nothing;
  }
  const content = props.skillCardContents[skill.skillKey];
  if (content === undefined) {
    const error = props.skillCardErrors[skill.skillKey];
    if (error) {
      return html`<div class="callout danger">${error}</div>`;
    }
    return html`<div class="muted" style="font-size: 13px;">
      ${props.skillCardLoadingKey === skill.skillKey
        ? "Loading Skill Card..."
        : "Skill Card not loaded."}
    </div>`;
  }
  return html`
    <article class="sidebar-markdown" style="max-width: 100%; overflow-wrap: anywhere;">
      ${unsafeHTML(toSanitizedMarkdownHtml(content))}
    </article>
  `;
}
