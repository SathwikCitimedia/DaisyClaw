/**
 * Simplified automation creation flow — Routines-style guided wizard.
 *
 * "What should it do?" → "When should it run?" → "How should it deliver?"
 *
 * Maps to the existing CronFormState fields under the hood.
 */

import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import { DEFAULT_CRON_FORM } from "../app-defaults.ts";
import { describeCronForm } from "../cron-describe.ts";
import { icons } from "../icons.ts";
import type { CronFormState } from "../ui-types.ts";

// ── Types ──

export type CronQuickCreateProps = {
  open: boolean;
  step: CronQuickCreateStep;
  draft: CronQuickCreateDraft;
  onDraftChange: (patch: Partial<CronQuickCreateDraft>) => void;
  onStepChange: (step: CronQuickCreateStep) => void;
  onCreate: () => void;
  onCancel: () => void;
  onAdvancedCreate?: () => void;
  /**
   * Splits the step-one sentence into task and schedule before step two. When
   * absent, Next simply moves on.
   */
  onDescribe?: () => void;
  /** Whether a chat app is set up to receive results. */
  hasChatApps?: boolean;
  /** True while the job is being saved. */
  creating?: boolean;
  /** Why the last save failed, in words for the user. */
  createError?: string | null;
};

export type CronQuickCreateStep = "what" | "when" | "how";

export type CronQuickCreateDraft = {
  prompt: string;
  name: string;
  schedulePreset: SchedulePresetId | "custom";
  deliveryPreset: DeliveryPresetId;
  /** The schedule for the "custom" preset; times are local datetime values. */
  custom?: CronQuickCreateCustomSchedule;
  /** True while step one's sentence is being split into task and schedule. */
  describing?: boolean;
  /** Set when the task was rewritten from the user's sentence, to say so. */
  splitFrom?: string;
  /** Why the last Create failed, shown above the buttons until the next try. */
  createError?: string;
};

export type CronQuickCreateCustomSchedule =
  | { kind: "every"; amount: string; unit: CronFormState["everyUnit"]; startAt: string }
  | { kind: "cron"; expr: string }
  | { kind: "at"; at: string };

const DEFAULT_CUSTOM_SCHEDULE: CronQuickCreateCustomSchedule = {
  kind: "every",
  amount: "30",
  unit: "minutes",
  startAt: "",
};

type SchedulePresetId =
  | "every-morning"
  | "every-evening"
  | "hourly"
  | "weekdays"
  | "weekly"
  | "once";

type DeliveryPresetId = "notify" | "silent" | "isolated";

// ── Presets ──

type SchedulePreset = {
  id: SchedulePresetId;
  labelKey: string;
  icon: string;
  descriptionKey: string;
};

const SCHEDULE_PRESETS: SchedulePreset[] = [
  {
    id: "every-morning",
    labelKey: "cron.quickCreate.schedules.everyMorning.label",
    icon: "🌅",
    descriptionKey: "cron.quickCreate.schedules.everyMorning.description",
  },
  {
    id: "every-evening",
    labelKey: "cron.quickCreate.schedules.everyEvening.label",
    icon: "🌙",
    descriptionKey: "cron.quickCreate.schedules.everyEvening.description",
  },
  {
    id: "hourly",
    labelKey: "cron.quickCreate.schedules.hourly.label",
    icon: "🔄",
    descriptionKey: "cron.quickCreate.schedules.hourly.description",
  },
  {
    id: "weekdays",
    labelKey: "cron.quickCreate.schedules.weekdays.label",
    icon: "📅",
    descriptionKey: "cron.quickCreate.schedules.weekdays.description",
  },
  {
    id: "weekly",
    labelKey: "cron.quickCreate.schedules.weekly.label",
    icon: "📆",
    descriptionKey: "cron.quickCreate.schedules.weekly.description",
  },
  {
    id: "once",
    labelKey: "cron.quickCreate.schedules.once.label",
    icon: "⚡",
    descriptionKey: "cron.quickCreate.schedules.once.description",
  },
];

const CUSTOM_PRESET = {
  labelKey: "cron.quickCreate.schedules.custom.label",
  icon: "⏱",
  descriptionKey: "cron.quickCreate.schedules.custom.description",
};

type DeliveryPreset = {
  id: DeliveryPresetId;
  labelKey: string;
  descriptionKey: string;
};

// Two choices: tell me, or don't. "Silent" used to run the task inside the main
// chat, which the scheduler allows only for reminder notes, so every task saved
// with it was refused and Create seemed to do nothing. Both now run the task on
// its own. The old "Independent session" was the same as the new Silent.
const DELIVERY_PRESETS: DeliveryPreset[] = [
  {
    id: "notify",
    labelKey: "cron.quickCreate.delivery.notify.label",
    descriptionKey: "cron.quickCreate.delivery.notify.description",
  },
  {
    id: "silent",
    labelKey: "cron.quickCreate.delivery.silent.label",
    descriptionKey: "cron.quickCreate.delivery.silent.description",
  },
];

// ── Default draft ──

export function createDefaultDraft(): CronQuickCreateDraft {
  return {
    prompt: "",
    name: "",
    schedulePreset: "every-morning",
    deliveryPreset: "notify",
  };
}

function buildDefaultScheduleAt(now = new Date()): string {
  const next = new Date(now);
  next.setHours(next.getHours() + 1, 0, 0, 0);
  const year = next.getFullYear();
  const month = String(next.getMonth() + 1).padStart(2, "0");
  const day = String(next.getDate()).padStart(2, "0");
  const hour = String(next.getHours()).padStart(2, "0");
  const minute = String(next.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/**
 * Takes a job drafted from the step-one sentence: the task without its timing,
 * and the timing as a custom schedule, so "every 20 min … starting 4:05 PM"
 * is not squeezed into the nearest preset.
 */
export function applyCronDraftToQuickCreate(
  draft: CronQuickCreateDraft,
  job: {
    name: string;
    task: string;
    schedule:
      | { kind: "every"; amount: number; unit: CronFormState["everyUnit"]; startAt?: string }
      | { kind: "cron"; expr: string }
      | { kind: "at"; at: string };
  },
): CronQuickCreateDraft {
  const schedule = job.schedule;
  const custom: CronQuickCreateCustomSchedule =
    schedule.kind === "every"
      ? {
          kind: "every",
          amount: String(schedule.amount),
          unit: schedule.unit,
          startAt: schedule.startAt ?? "",
        }
      : schedule.kind === "cron"
        ? { kind: "cron", expr: schedule.expr }
        : { kind: "at", at: schedule.at };
  const original = draft.prompt.trim();
  return {
    ...draft,
    name: draft.name.trim() || job.name,
    prompt: job.task,
    splitFrom: job.task !== original ? original : undefined,
    schedulePreset: "custom",
    custom,
    describing: false,
  };
}

// ── Convert draft to CronFormState patch ──

export function draftToCronFormPatch(draft: CronQuickCreateDraft): Partial<CronFormState> {
  const patch: Partial<CronFormState> = {
    name: draft.name || t("cron.quickCreate.defaultName"),
    payloadKind: "agentTurn",
    deleteAfterRun: false,
    scheduleAt: "",
    payloadText: draft.prompt,
    enabled: true,
  };

  // Schedule
  switch (draft.schedulePreset) {
    case "every-morning":
      patch.scheduleKind = "cron";
      patch.cronExpr = "0 8 * * *";
      break;
    case "every-evening":
      patch.scheduleKind = "cron";
      patch.cronExpr = "0 18 * * *";
      break;
    case "hourly":
      patch.scheduleKind = "every";
      patch.everyAmount = "1";
      patch.everyUnit = "hours";
      break;
    case "weekdays":
      patch.scheduleKind = "cron";
      patch.cronExpr = "0 9 * * 1-5";
      break;
    case "weekly":
      patch.scheduleKind = "cron";
      patch.cronExpr = "0 9 * * 1";
      break;
    case "once":
      patch.scheduleKind = "at";
      patch.scheduleAt = buildDefaultScheduleAt();
      patch.deleteAfterRun = true;
      break;
    case "custom": {
      const custom = draft.custom ?? DEFAULT_CUSTOM_SCHEDULE;
      if (custom.kind === "every") {
        patch.scheduleKind = "every";
        patch.everyAmount = custom.amount;
        patch.everyUnit = custom.unit;
        patch.everyStartAt = custom.startAt;
      } else if (custom.kind === "cron") {
        patch.scheduleKind = "cron";
        patch.cronExpr = custom.expr;
        try {
          patch.cronTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        } catch {
          // Leave the gateway's own time zone.
        }
      } else {
        patch.scheduleKind = "at";
        patch.scheduleAt = custom.at;
        patch.deleteAfterRun = true;
      }
      break;
    }
    default:
      break;
  }

  // Delivery
  switch (draft.deliveryPreset) {
    case "notify":
      patch.sessionTarget = "isolated";
      patch.deliveryMode = "announce";
      patch.wakeMode = "now";
      break;
    case "silent":
    case "isolated":
      patch.sessionTarget = "isolated";
      patch.deliveryMode = "none";
      patch.wakeMode = "now";
      break;
  }

  return patch;
}

// ── Step indicators ──

const STEPS: CronQuickCreateStep[] = ["what", "when", "how"];
const STEP_LABELS: Record<CronQuickCreateStep, string> = {
  what: "cron.quickCreate.steps.what",
  when: "cron.quickCreate.steps.when",
  how: "cron.quickCreate.steps.how",
};

function renderStepIndicator(current: CronQuickCreateStep) {
  const currentIdx = STEPS.indexOf(current);
  return html`
    <div class="cqc-steps">
      ${STEPS.map((step, idx) => {
        const state = idx < currentIdx ? "done" : idx === currentIdx ? "active" : "pending";
        return html`
          <div class="cqc-step cqc-step--${state}">
            <span class="cqc-step__dot">${state === "done" ? "✓" : idx + 1}</span>
            <span class="cqc-step__label">${t(STEP_LABELS[step])}</span>
          </div>
          ${idx < STEPS.length - 1
            ? html`<div class="cqc-step__line cqc-step__line--${state}"></div>`
            : nothing}
        `;
      })}
    </div>
  `;
}

// ── Step renderers ──

function renderAdvancedButton(props: CronQuickCreateProps) {
  if (!props.onAdvancedCreate) {
    return nothing;
  }
  return html`
    <button class="btn cqc-advanced-button" @click=${props.onAdvancedCreate}>
      ${t("cron.form.advanced")}
    </button>
  `;
}

function renderWhatStep(props: CronQuickCreateProps) {
  return html`
    <div class="cqc-body">
      <h3 class="cqc-body__heading">${t("cron.quickCreate.whatHeading")}</h3>
      <p class="cqc-body__hint muted">${t("cron.quickCreate.whatHint")}</p>
      <textarea
        class="cqc-textarea"
        placeholder=${t("cron.quickCreate.promptPlaceholder")}
        rows="4"
        .value=${props.draft.prompt}
        @input=${(e: Event) =>
          props.onDraftChange({ prompt: (e.target as HTMLTextAreaElement).value })}
      ></textarea>
      <div class="cqc-field">
        <label class="cqc-field__label">${t("cron.quickCreate.nameOptional")}</label>
        <input
          class="cqc-input"
          type="text"
          placeholder=${t("cron.quickCreate.namePlaceholder")}
          .value=${props.draft.name}
          @input=${(e: Event) =>
            props.onDraftChange({ name: (e.target as HTMLInputElement).value })}
        />
      </div>
    </div>
    <div class="cqc-actions">
      <div class="cqc-actions__secondary">
        <button class="btn" @click=${props.onCancel}>${t("common.cancel")}</button>
        ${renderAdvancedButton(props)}
      </div>
      <button
        class="btn primary"
        ?disabled=${!props.draft.prompt.trim() || props.draft.describing}
        @click=${() => (props.onDescribe ? props.onDescribe() : props.onStepChange("when"))}
      >
        ${props.draft.describing
          ? t("cron.quickCreate.describing")
          : html`${t("common.next")} ${icons.chevronRight}`}
      </button>
    </div>
  `;
}

function renderCustomScheduleFields(props: CronQuickCreateProps) {
  const custom = props.draft.custom ?? DEFAULT_CUSTOM_SCHEDULE;
  const set = (next: CronQuickCreateCustomSchedule) => props.onDraftChange({ custom: next });
  if (custom.kind === "cron") {
    return html`
      <div class="cqc-custom">
        <label class="cqc-field__label" for="cqc-custom-cron">${t("cron.form.expression")}</label>
        <input
          id="cqc-custom-cron"
          class="cqc-input"
          .value=${custom.expr}
          @input=${(e: Event) => set({ kind: "cron", expr: (e.target as HTMLInputElement).value })}
        />
      </div>
    `;
  }
  if (custom.kind === "at") {
    return html`
      <div class="cqc-custom">
        <label class="cqc-field__label" for="cqc-custom-at">${t("cron.form.runAt")}</label>
        <input
          id="cqc-custom-at"
          class="cqc-input"
          type="datetime-local"
          .value=${custom.at}
          @input=${(e: Event) => set({ kind: "at", at: (e.target as HTMLInputElement).value })}
        />
      </div>
    `;
  }
  return html`
    <div class="cqc-custom cqc-custom--every">
      <label class="cqc-field__label" for="cqc-custom-amount">${t("cron.form.every")}</label>
      <div class="cqc-custom__row">
        <input
          id="cqc-custom-amount"
          class="cqc-input cqc-custom__amount"
          inputmode="numeric"
          .value=${custom.amount}
          @input=${(e: Event) =>
            set({ ...custom, amount: (e.target as HTMLInputElement).value.replace(/\D/g, "") })}
        />
        <select
          class="cqc-input cqc-custom__unit"
          .value=${custom.unit}
          @change=${(e: Event) =>
            set({
              ...custom,
              unit: (e.target as HTMLSelectElement).value as CronFormState["everyUnit"],
            })}
        >
          <option value="minutes">${t("cron.form.minutes")}</option>
          <option value="hours">${t("cron.form.hours")}</option>
          <option value="days">${t("cron.form.days")}</option>
        </select>
      </div>
      <label class="cqc-field__label" for="cqc-custom-start">${t("cron.form.startingAt")}</label>
      <input
        id="cqc-custom-start"
        class="cqc-input"
        type="datetime-local"
        .value=${custom.startAt}
        @input=${(e: Event) => set({ ...custom, startAt: (e.target as HTMLInputElement).value })}
      />
      <span class="cqc-body__hint muted">${t("cron.form.startingAtHint")}</span>
    </div>
  `;
}

function renderWhenStep(props: CronQuickCreateProps) {
  return html`
    <div class="cqc-body">
      <h3 class="cqc-body__heading">${t("cron.quickCreate.whenHeading")}</h3>
      <p class="cqc-body__hint muted">${t("cron.quickCreate.whenHint")}</p>
      ${props.draft.splitFrom
        ? html`<div class="cqc-split-note" role="status">
            <span>${t("cron.quickCreate.splitNote")}</span>
            <span class="cqc-split-note__task">${props.draft.prompt}</span>
          </div>`
        : nothing}
      <div class="cqc-preset-grid">
        ${SCHEDULE_PRESETS.map(
          (preset) => html`
            <button
              class="cqc-preset-card ${props.draft.schedulePreset === preset.id
                ? "cqc-preset-card--active"
                : ""}"
              @click=${() => props.onDraftChange({ schedulePreset: preset.id })}
            >
              <span class="cqc-preset-card__icon">${preset.icon}</span>
              <span class="cqc-preset-card__label">${t(preset.labelKey)}</span>
              <span class="cqc-preset-card__desc muted">${t(preset.descriptionKey)}</span>
            </button>
          `,
        )}
        <button
          class="cqc-preset-card ${props.draft.schedulePreset === "custom"
            ? "cqc-preset-card--active"
            : ""}"
          @click=${() =>
            props.onDraftChange({
              schedulePreset: "custom",
              custom: props.draft.custom ?? DEFAULT_CUSTOM_SCHEDULE,
            })}
        >
          <span class="cqc-preset-card__icon">${CUSTOM_PRESET.icon}</span>
          <span class="cqc-preset-card__label">${t(CUSTOM_PRESET.labelKey)}</span>
          <span class="cqc-preset-card__desc muted">${t(CUSTOM_PRESET.descriptionKey)}</span>
        </button>
      </div>
      ${props.draft.schedulePreset === "custom" ? renderCustomScheduleFields(props) : nothing}
    </div>
    <div class="cqc-actions">
      <div class="cqc-actions__secondary">
        <button class="btn" @click=${() => props.onStepChange("what")}>${t("common.back")}</button>
        ${renderAdvancedButton(props)}
      </div>
      <button class="btn primary" @click=${() => props.onStepChange("how")}>
        ${t("common.next")} ${icons.chevronRight}
      </button>
    </div>
  `;
}

function renderHowStep(props: CronQuickCreateProps) {
  return html`
    <div class="cqc-body">
      <h3 class="cqc-body__heading">${t("cron.quickCreate.howHeading")}</h3>
      <p class="cqc-body__hint muted">${t("cron.quickCreate.howHint")}</p>
      <div class="cqc-delivery-options">
        ${DELIVERY_PRESETS.map(
          (preset) => html`
            <label
              class="cqc-radio-card ${props.draft.deliveryPreset === preset.id
                ? "cqc-radio-card--active"
                : ""}"
            >
              <input
                type="radio"
                name="delivery"
                .checked=${props.draft.deliveryPreset === preset.id}
                @change=${() => props.onDraftChange({ deliveryPreset: preset.id })}
              />
              <span class="cqc-radio-card__label">${t(preset.labelKey)}</span>
              <span class="cqc-radio-card__desc muted">${t(preset.descriptionKey)}</span>
            </label>
          `,
        )}
      </div>
      <div class="cqc-summary" aria-live="polite">
        <span class="cqc-summary__label">${t("cron.form.summaryLabel")}</span>
        <span
          >${describeCronForm(
            { ...DEFAULT_CRON_FORM, ...draftToCronFormPatch(props.draft) } as CronFormState,
            props.hasChatApps === true,
          )}</span
        >
      </div>
    </div>
    ${props.createError
      ? html`<div class="cqc-error" role="alert">${props.createError}</div>`
      : nothing}
    <div class="cqc-actions">
      <div class="cqc-actions__secondary">
        <button class="btn" ?disabled=${props.creating} @click=${() => props.onStepChange("when")}>
          ${t("common.back")}
        </button>
        ${renderAdvancedButton(props)}
      </div>
      <button class="btn primary" ?disabled=${props.creating} @click=${props.onCreate}>
        ${props.creating
          ? t("cron.quickCreate.creating")
          : html`${t("common.create")} ${icons.check}`}
      </button>
    </div>
  `;
}

// ── Main render ──

export function renderCronQuickCreate(props: CronQuickCreateProps) {
  if (!props.open) {
    return nothing;
  }

  return html`
    <div class="cqc-backdrop" @click=${props.onCancel}>
      <section
        class="cqc-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cron-quick-create-title"
        @click=${(event: Event) => event.stopPropagation()}
      >
        <div class="cqc-header">
          <h2 id="cron-quick-create-title" class="cqc-header__title">
            ${icons.zap} ${t("cron.quickCreate.title")}
          </h2>
          <button
            type="button"
            class="cqc-header__close"
            aria-label=${t("common.dismiss")}
            @click=${props.onCancel}
          >
            ${icons.x}
          </button>
        </div>

        ${renderStepIndicator(props.step)}
        ${props.step === "what"
          ? renderWhatStep(props)
          : props.step === "when"
            ? renderWhenStep(props)
            : renderHowStep(props)}
      </section>
    </div>
  `;
}
