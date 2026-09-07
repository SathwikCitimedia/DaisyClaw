// Control UI view renders per-settings-tab "How to use this page" help dialogs.
import { html, nothing, type TemplateResult } from "lit";
import { ref } from "lit/directives/ref.js";
import { icons } from "../icons.ts";

export type SettingsHelpEntry = { term: string; text: string };

export type SettingsHelpSection = {
  heading: string;
  intro?: string;
  entries?: SettingsHelpEntry[];
  example?: { title: string; steps: string[] };
  note?: string;
};

export type SettingsHelpTopic = {
  title: string;
  tagline: string;
  intro: string;
  sections: SettingsHelpSection[];
};

// Shared explanation of the action buttons that appear on every settings tab.
const TOOLBAR_SECTION: SettingsHelpSection = {
  heading: "The buttons on top",
  intro:
    "Every settings tab edits the same configuration file behind the scenes. These buttons control when your edits become real.",
  entries: [
    {
      term: "Save",
      text: "Writes your changes to the configuration file. Some changes only take effect after the next restart.",
    },
    {
      term: "Apply",
      text: "Writes your changes AND restarts the assistant so they take effect immediately. Your chats and memory are kept — only the engine restarts.",
    },
    {
      term: "Clear",
      text: "Throws away everything you typed since the last save. Nothing on disk changes.",
    },
    {
      term: "Reload",
      text: "Re-reads the configuration from disk. Useful if the file was changed outside this page.",
    },
    {
      term: "Open",
      text: "Opens the raw configuration file (daisyclaw.json) so you can see exactly what is stored.",
    },
    {
      term: "Update",
      text: "Not related to settings — this updates the DaisyClaw software itself to the latest version.",
    },
  ],
  note: "The blue “unsaved changes” pill means you edited something but have not pressed Save or Apply yet. Click “View pending change” to see exactly what will change.",
};

const SETTINGS_HELP_TOPICS: Record<string, SettingsHelpTopic> = {
  communications: {
    title: "Communications",
    tagline: "How your assistant talks with you — across every app.",
    intro:
      "This page controls the messaging side of your assistant: which chat apps it lives in, how it formats and delivers messages, and how voice works. If you just want to connect WhatsApp or Telegram, the Channels page in the sidebar is the friendlier place — this page is for fine-tuning.",
    sections: [
      {
        heading: "What each section means",
        entries: [
          {
            term: "Channels",
            text: "The chat apps your assistant is connected to (WhatsApp, Telegram, Discord, Slack…). Each channel has its own settings like who is allowed to talk to it.",
          },
          {
            term: "Messages",
            text: "How replies are delivered: message length limits, how long messages are split, typing indicators, and queue behavior.",
          },
          {
            term: "Broadcast",
            text: "Send one announcement to several channels at once — for example a daily summary posted to two group chats.",
          },
          {
            term: "Notifications",
            text: "Browser notifications from this dashboard, so you notice replies while the tab is in the background.",
          },
          {
            term: "Talk",
            text: "Real-time voice conversation settings — the “talk to Daisy” experience.",
          },
          {
            term: "Audio",
            text: "Voice input/output details: which voice is used for speech, and how audio messages are transcribed.",
          },
        ],
      },
      {
        heading: "A real example",
        example: {
          title: "Only allow your own number on WhatsApp",
          steps: [
            "Click the Channels section on this page.",
            "Open the WhatsApp group and find the allowlist field.",
            "Add your phone number in international format (e.g. +9198…).",
            "Press Apply — from now on, only that number gets replies.",
          ],
        },
        note: "Adding or scanning a new WhatsApp/Telegram account is easier on the Channels page in the sidebar — it has step-by-step connect buttons.",
      },
    ],
  },
  automation: {
    title: "Automation",
    tagline: "Things your assistant does on its own, on a schedule or on a trigger.",
    intro:
      "This page makes your assistant proactive instead of only answering when spoken to. You can schedule recurring jobs, run custom commands, and react to events automatically.",
    sections: [
      {
        heading: "What each section means",
        entries: [
          {
            term: "Commands",
            text: "Chat commands (like /status) — which ones are enabled and who may use them.",
          },
          {
            term: "Hooks",
            text: "Small scripts that run automatically when something happens — for example “when a new message arrives, log it”. Advanced feature; most people never need it.",
          },
          {
            term: "Bindings",
            text: "Routing rules: which chat channel or account talks to which agent. With one assistant you can ignore this.",
          },
          {
            term: "Cron",
            text: "Scheduled jobs — the assistant wakes up at a set time and does something: a morning briefing, a weekly reminder, a nightly cleanup.",
          },
          {
            term: "Approvals",
            text: "Safety gate: which risky actions (like running shell commands) need your approval before the assistant may do them.",
          },
          {
            term: "Plugins",
            text: "Optional extensions that add new abilities or channels. Enable or disable them here.",
          },
        ],
      },
      {
        heading: "A real example",
        example: {
          title: "A daily 8 AM briefing on WhatsApp",
          steps: [
            "Open the Cron Jobs page in the sidebar (easier than editing raw cron here).",
            "Create a job with schedule “every day at 8:00”.",
            "Set the prompt to “Send me today's weather and my reminders”.",
            "Choose WhatsApp as the delivery channel and save.",
          ],
        },
        note: "This settings page shows the raw configuration behind those jobs. Creating and testing jobs is friendlier on the Cron Jobs page.",
      },
    ],
  },
  mcp: {
    title: "MCP",
    tagline: "A standard plug for connecting external tools to your assistant.",
    intro:
      "MCP (Model Context Protocol) is like a USB port for AI: services and apps that speak MCP can plug into your assistant and give it new abilities — reading your notes app, querying a database, controlling other software. If you don't use MCP servers, you can ignore this page completely.",
    sections: [
      {
        heading: "What you can do here",
        entries: [
          {
            term: "Servers",
            text: "The list of MCP servers your assistant connects to. Each entry has a name, how to start or reach it (a command or a URL), and optional credentials.",
          },
          {
            term: "Auth",
            text: "Some servers need you to sign in once. Their login status shows here.",
          },
          {
            term: "Tools",
            text: "Every connected server offers tools (actions). Once connected, the assistant can use them in conversation automatically.",
          },
        ],
      },
      {
        heading: "A real example",
        example: {
          title: "Connect a notes MCP server",
          steps: [
            "Get the server's start command or URL from its documentation.",
            "Add a new entry under Servers with a name like “notes”.",
            "Paste the command/URL, then press Save & Publish.",
            "Ask the assistant something like “what's in my notes about the trip?” — it can now use the server's tools.",
          ],
        },
        note: "Only add MCP servers you trust. A connected server can see what the assistant sends it and can act with the abilities you give it.",
      },
    ],
  },
  infrastructure: {
    title: "Infrastructure",
    tagline: "The engine room: how the assistant runs on this computer.",
    intro:
      "Everything here is about the machinery underneath — the background service (gateway), this dashboard, the built-in browser, and media processing. It is the most technical tab, and the one you least need to touch: the defaults are chosen to just work.",
    sections: [
      {
        heading: "What each section means",
        entries: [
          {
            term: "Gateway",
            text: "The background service that IS your assistant — it runs all the time, connects the channels, and serves this dashboard. Port, password, and network settings live here.",
          },
          {
            term: "Web",
            text: "Settings for this dashboard itself — how it is served and reached.",
          },
          {
            term: "Browser",
            text: "The assistant's built-in web browser, used when a skill needs to open a page or take a screenshot.",
          },
          {
            term: "NodeHost / Discovery",
            text: "For linking other devices (like a second computer or phone node) to this assistant. Ignore unless you pair devices.",
          },
          {
            term: "Media",
            text: "How images, audio, and video attachments are processed and stored.",
          },
        ],
      },
      {
        heading: "A real example",
        example: {
          title: "Move the dashboard to another port",
          steps: [
            "Open Gateway and change the port number (default 18789).",
            "Press Apply — the assistant restarts on the new port.",
            "Open the dashboard at the new address (the old tab will stop working).",
          ],
        },
        note: "Be careful here: a wrong gateway setting can make this dashboard unreachable until it is fixed in the config file directly. If everything works, there is nothing you need to change on this page.",
      },
    ],
  },
  aiAgents: {
    title: "AI & Agents",
    tagline: "The brain: who your assistant is, what it thinks with, and what it may do.",
    intro:
      "This page configures the assistant itself. Six sections answer six questions: who is the assistant (Agents), what LLM does it think with (Models), what can it do (Skills), what may it touch (Tools), how does it remember (Memory), and how do conversations behave (Session).",
    sections: [
      {
        heading: "What each section means",
        entries: [
          {
            term: "Agents",
            text: "The assistants themselves. Each entry has a name, a workspace folder, and a model. “Agent Defaults” are shared baseline settings every agent inherits — almost always fine as they are.",
          },
          {
            term: "Models",
            text: "Your LLM providers and API keys — OpenAI, Anthropic, or a custom endpoint like LiteLLM or Ollama — plus fallback models if the first one fails.",
          },
          {
            term: "Skills",
            text: "Raw on/off switches and API keys per skill. The Skills page in the sidebar is the friendlier way to manage the same thing.",
          },
          {
            term: "Tools",
            text: "Permissions: may the assistant run shell commands, browse the web, edit files? Deny a tool here and no skill can use it.",
          },
          {
            term: "Memory",
            text: "Long-term memory and “dreaming” (background memory consolidation) settings.",
          },
          {
            term: "Session",
            text: "Conversation behavior: when chat history resets (e.g. daily at 4 AM), idle timeouts, and per-channel overrides.",
          },
        ],
      },
      {
        heading: "A real example",
        example: {
          title: "Use your own LLM (e.g. LiteLLM or Ollama)",
          steps: [
            "Open Models and add a provider with your endpoint URL (e.g. http://localhost:4000/v1) and API key.",
            "Open Agents and set your agent's model to that provider's model name.",
            "Press Apply — the assistant now thinks with your model.",
          ],
        },
        note: "Creating a second agent (a separate assistant with its own personality and channels) is done by adding an entry under Agents → list. Most people only ever need one.",
      },
    ],
  },
};

export function getSettingsHelpTopic(tab: string): SettingsHelpTopic | null {
  const topic = SETTINGS_HELP_TOPICS[tab];
  if (!topic) {
    return null;
  }
  return { ...topic, sections: [...topic.sections, TOOLBAR_SECTION] };
}

export function hasSettingsHelp(tab: string): boolean {
  return Boolean(SETTINGS_HELP_TOPICS[tab]);
}

function showDialogWhenClosed(el?: Element) {
  if (!(el instanceof HTMLDialogElement) || el.open) {
    return;
  }
  if (el.isConnected) {
    el.showModal();
  } else {
    // Lit may run the ref callback before the dialog is attached to the
    // document; showModal() on a disconnected dialog throws and aborts the
    // whole render commit. Retry once the element is connected.
    queueMicrotask(() => {
      if (el.isConnected && !el.open) {
        el.showModal();
      }
    });
  }
}

function renderSection(section: SettingsHelpSection): TemplateResult {
  return html`
    <div class="settings-help__section">
      <div class="settings-help__heading">${section.heading}</div>
      ${section.intro
        ? html`<div class="settings-help__section-intro">${section.intro}</div>`
        : nothing}
      ${section.entries?.length
        ? html`
            <div class="settings-help__entries">
              ${section.entries.map(
                (entry) => html`
                  <div class="settings-help__entry">
                    <div class="settings-help__term">${entry.term}</div>
                    <div class="settings-help__entry-text">${entry.text}</div>
                  </div>
                `,
              )}
            </div>
          `
        : nothing}
      ${section.example
        ? html`
            <div class="settings-help__example">
              <div class="settings-help__example-title">${section.example.title}</div>
              <ol>
                ${section.example.steps.map((step) => html`<li>${step}</li>`)}
              </ol>
            </div>
          `
        : nothing}
      ${section.note ? html`<div class="settings-help__note">${section.note}</div>` : nothing}
    </div>
  `;
}

export function renderSettingsHelpButton(onOpen: () => void) {
  return html`
    <button
      type="button"
      class="btn btn--subtle btn--sm settings-help-open-btn"
      title="A plain-language guide to everything on this page"
      @click=${onOpen}
    >
      ${icons.helpCircle} How to use this page
    </button>
  `;
}

export function renderSettingsHelpDialog(tab: string, onClose: () => void) {
  const topic = getSettingsHelpTopic(tab);
  if (!topic) {
    return nothing;
  }
  return html`
    <dialog
      class="md-preview-dialog settings-help-dialog"
      ${ref(showDialogWhenClosed)}
      @click=${(e: Event) => {
        const dialog = e.currentTarget as HTMLDialogElement;
        if (e.target === dialog) {
          dialog.close();
        }
      }}
      @close=${onClose}
    >
      <div class="md-preview-dialog__panel">
        <div class="md-preview-dialog__header">
          <div class="md-preview-dialog__header-main">
            <div class="md-preview-dialog__eyebrow">How to use this page</div>
            <div class="md-preview-dialog__title">${topic.title}</div>
            <div class="settings-help__tagline">${topic.tagline}</div>
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
        <div class="md-preview-dialog__body settings-help">
          <div class="settings-help__intro">${topic.intro}</div>
          ${topic.sections.map((section) => renderSection(section))}
        </div>
      </div>
    </dialog>
  `;
}
