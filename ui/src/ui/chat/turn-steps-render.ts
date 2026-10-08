// Control UI chat module renders a finished reply's folded steps: one quiet
// line ("Searched the web twice") that opens to show what was done.
import { html, nothing, type TemplateResult } from "lit";
import { icons } from "../icons.ts";
import type { ChatItem, MessageGroup } from "../types/chat-types.ts";

type StepsItem = Extract<ChatItem, { kind: "steps" }>;

export type TurnStepsRenderOptions = {
  open: boolean;
  onToggle: () => void;
  /** Draws one step group (narration, tool calls and their output). */
  renderGroup: (group: MessageGroup) => unknown;
};

export function renderTurnSteps(item: StepsItem, opts: TurnStepsRenderOptions): TemplateResult {
  return html`
    <div class="chat-turn-steps ${opts.open ? "is-open" : ""}" data-turn-steps>
      <button
        type="button"
        class="chat-turn-steps__toggle"
        aria-expanded=${String(opts.open)}
        title=${opts.open ? "Hide the steps" : "Show what Daisy did"}
        @click=${() => opts.onToggle()}
      >
        <span class="chat-turn-steps__chevron" aria-hidden="true">${icons.chevronRight}</span>
        <span class="chat-turn-steps__summary">${item.summary}</span>
      </button>
      ${opts.open
        ? html`<div class="chat-turn-steps__body">
            ${item.groups.map((group) => opts.renderGroup(group))}
          </div>`
        : nothing}
    </div>
  `;
}
