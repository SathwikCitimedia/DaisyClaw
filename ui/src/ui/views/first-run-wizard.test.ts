/* @vitest-environment jsdom */

import { render } from "lit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppViewState } from "../app-view-state.ts";
import {
  evaluateFirstRunWizard,
  isFirstRunDismissed,
  markFirstRunDone,
  renderFirstRunWizard,
} from "./first-run-wizard.ts";

const DONE_KEY = "daisyclaw.control.firstRunDone.v1";

function createState(overrides: Record<string, unknown> = {}): AppViewState {
  return {
    connected: true,
    firstRunActive: null,
    firstRunStep: 0,
    firstRunBusy: false,
    firstRunError: null,
    firstRunProvider: null,
    skillsLoading: false,
    skillsReport: null,
    skillMessages: {},
    channelsSnapshot: null,
    channelsFocus: null,
    setTab: vi.fn(),
    client: {
      request: vi.fn(async (method: string) => {
        if (method === "config.get") {
          return { hash: "h", config: {} };
        }
        return {};
      }),
    },
    ...overrides,
  } as unknown as AppViewState;
}

function createStorageMock(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

beforeEach(() => {
  // getSafeLocalStorage only accepts an own value property under vitest, so
  // jsdom's getter-based localStorage must be replaced with a plain mock.
  vi.stubGlobal("localStorage", createStorageMock());
  localStorage.removeItem(DONE_KEY);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("evaluateFirstRunWizard", () => {
  it("activates on a fresh install (no providers, no default model)", async () => {
    const state = createState();
    await evaluateFirstRunWizard(state);
    expect(state.firstRunActive).toBe(true);
  });

  it("stays hidden when a provider is configured", async () => {
    const state = createState({
      client: {
        request: vi.fn(async (method: string) =>
          method === "config.get"
            ? { hash: "h", config: { models: { providers: { openai: { apiKey: "sk" } } } } }
            : {},
        ),
      },
    });
    await evaluateFirstRunWizard(state);
    expect(state.firstRunActive).toBe(false);
  });

  it("stays hidden when a default model is set", async () => {
    const state = createState({
      client: {
        request: vi.fn(async (method: string) =>
          method === "config.get"
            ? { hash: "h", config: { agents: { defaults: { model: "openai/gpt-5" } } } }
            : {},
        ),
      },
    });
    await evaluateFirstRunWizard(state);
    expect(state.firstRunActive).toBe(false);
  });

  it("never re-activates after completion", async () => {
    const done = createState();
    markFirstRunDone(done);
    expect(isFirstRunDismissed()).toBe(true);

    const state = createState();
    await evaluateFirstRunWizard(state);
    expect(state.firstRunActive).toBe(false);
  });

  it("falls open to the dashboard when config cannot be read", async () => {
    const state = createState({
      client: {
        request: vi.fn(async () => {
          throw new Error("boom");
        }),
      },
    });
    await evaluateFirstRunWizard(state);
    expect(state.firstRunActive).toBe(false);
  });

  it("does not re-evaluate once decided", async () => {
    const request = vi.fn();
    const state = createState({ firstRunActive: false, client: { request } });
    await evaluateFirstRunWizard(state);
    expect(request).not.toHaveBeenCalled();
  });
});

describe("renderFirstRunWizard", () => {
  it("renders the welcome step with a start button and skip link", () => {
    const state = createState({ firstRunActive: true });
    const host = document.createElement("div");
    render(renderFirstRunWizard(state), host);
    const text = host.textContent ?? "";
    expect(text).toContain("Hi — I'm Daisy");
    expect(text).toContain("Get started");
    expect(text).toContain("skip");
  });

  it("renders provider presets on the brain step, including a custom server", () => {
    const state = createState({ firstRunActive: true, firstRunStep: 1 });
    const host = document.createElement("div");
    render(renderFirstRunWizard(state), host);
    const text = host.textContent ?? "";
    expect(text).toContain("Add your AI brain");
    expect(text).toContain("OpenAI");
    expect(text).toContain("Anthropic");
    expect(text).toContain("Custom server");
  });

  it("offers the full channel menu regardless of what is configured", () => {
    const state = createState({ firstRunActive: true, firstRunStep: 3 });
    const host = document.createElement("div");
    render(renderFirstRunWizard(state), host);
    const text = host.textContent ?? "";
    for (const label of ["WhatsApp", "Telegram", "Discord", "Slack", "Signal", "Google Chat"]) {
      expect(text).toContain(label);
    }
    expect(text).toContain("Skip for now");
  });

  it("embeds the guided channel setup inside the wizard", () => {
    const state = createState({
      firstRunActive: true,
      firstRunStep: 3,
      firstRunChannel: "telegram",
      configForm: {},
      configFormDirty: false,
      configSaving: false,
      channelSetupBusy: null,
    });
    const host = document.createElement("div");
    render(renderFirstRunWizard(state), host);
    const text = host.textContent ?? "";
    expect(text).toContain("Connect Telegram");
    expect(text).toContain("BotFather");
    // Returning to the channel picker is the card's top-left Back control.
    expect(host.querySelector(".first-run__topback")).toBeTruthy();
    // Stays inside the wizard — no dashboard navigation happened.
    expect(state.setTab).not.toHaveBeenCalled();
  });

  it("finishing marks the wizard done and opens chat", () => {
    const state = createState({ firstRunActive: true, firstRunStep: 4 });
    const host = document.createElement("div");
    render(renderFirstRunWizard(state), host);
    const button = host.querySelector(".first-run__cta") as HTMLButtonElement;
    button.click();
    expect(state.firstRunActive).toBe(false);
    expect(isFirstRunDismissed()).toBe(true);
    expect(state.setTab).toHaveBeenCalledWith("chat");
  });
});
