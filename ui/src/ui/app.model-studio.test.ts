/* @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";

describe("DaisyClawApp Model Studio", () => {
  async function createApp() {
    await import("./app.ts");
    const app = document.createElement("daisyclaw-app") as import("./app.ts").DaisyClawApp;
    document.body.append(app);
    return app;
  }

  /** Realistic user config — quick settings must survive a fully-populated form. */
  const REAL_SHAPE_CONFIG = {
    agents: {
      defaults: {
        workspace: "C:\\Users\\user\\.daisyclaw\\workspace",
        model: { primary: "litellm/claude-sonnet-4-5" },
      },
    },
    models: {
      providers: {
        litellm: {
          baseUrl: "http://127.0.0.1:4000/v1",
          apiKey: "sk-redacted",
          timeoutSeconds: 120,
          models: [
            {
              id: "claude-sonnet-4-5",
              name: "Claude Sonnet 4.5 (LiteLLM)",
              reasoning: false,
              input: ["text", "image"],
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              contextWindow: 200000,
              maxTokens: 8192,
            },
          ],
        },
      },
    },
    channels: {
      whatsapp: {
        enabled: true,
        dmPolicy: "allowlist",
        allowFrom: ["+919381241869", "+916305865365"],
        contactLabels: { "+919381241869": "Aasrith" },
      },
      telegram: { enabled: false },
    },
    gateway: {
      mode: "local",
      auth: { mode: "token", token: "redacted" },
      port: 18789,
      bind: "loopback",
      controlUi: { allowInsecureAuth: true },
    },
    diagnostics: { stuckSessionWarnMs: 60000, stuckSessionAbortMs: 120000 },
    session: { resetByChannel: { webchat: { idleMinutes: 10080 } } },
    browser: { enabled: false },
    tools: { profile: "full" },
  };

  function createConfigRequest() {
    return vi.fn(async (method: string) => {
      if (method === "config.get") {
        return { hash: "hash-1", config: REAL_SHAPE_CONFIG };
      }
      if (method === "config.schema") {
        return { schema: { type: "object", properties: {} }, uiHints: {} };
      }
      if (method === "models.list") {
        return {
          models: [
            { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5 (LiteLLM)", provider: "litellm" },
          ],
        };
      }
      if (method === "models.authStatus") {
        return { ts: 1, providers: [] };
      }
      if (method === "sessions.list") {
        return { sessions: [] };
      }
      return {};
    });
  }

  it(
    "renders Quick Settings with a fully-populated config and returns from advanced mode",
    { timeout: 30000 },
    async () => {
      const request = createConfigRequest();
      const app = await createApp();
      app.client = { request, stop: () => {} } as never;
      app.connected = true;
      app.tab = "config";
      app.configSettingsMode = "quick";
      await app.updateComplete;

      // Simulate the config snapshot arriving (the moment the user's page broke).
      const { applyConfigSnapshot } = await import("./controllers/config.ts");
      applyConfigSnapshot(app as never, { hash: "hash-1", config: REAL_SHAPE_CONFIG } as never);
      await app.updateComplete;

      const manage = Array.from(app.renderRoot.querySelectorAll("button")).find(
        (button) => button.textContent?.trim() === "Manage",
      );
      expect(manage, "Quick Settings should render with real config data").toBeTruthy();

      // Advanced settings and back — the round trip the user reported as frozen.
      const advanced = Array.from(app.renderRoot.querySelectorAll("button")).find((button) =>
        button.textContent?.trim().startsWith("Advanced"),
      );
      expect(advanced, "Advanced settings button should exist").toBeTruthy();
      advanced!.click();
      await app.updateComplete;
      expect(app.configSettingsMode).toBe("advanced");

      const back = app.renderRoot.querySelector(
        ".config-advanced__back",
      ) as HTMLButtonElement | null;
      expect(back, "Back-to-quick button should render in advanced mode").toBeTruthy();
      back!.click();
      await app.updateComplete;
      expect(app.configSettingsMode).toBe("quick");
      const manageAgain = Array.from(app.renderRoot.querySelectorAll("button")).find(
        (button) => button.textContent?.trim() === "Manage",
      );
      expect(manageAgain, "Quick Settings should render again after leaving advanced").toBeTruthy();
      app.remove();
    },
  );

  it("opens the Model Studio dialog when the Manage button is clicked", async () => {
    const request = vi.fn(async (method: string) => {
      if (method === "config.get") {
        return {
          hash: "hash-1",
          config: { agents: { defaults: { model: "litellm/claude-sonnet-4-5" } } },
        };
      }
      if (method === "models.list") {
        return {
          models: [{ id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", provider: "litellm" }],
        };
      }
      if (method === "models.authStatus") {
        return { ts: 1, providers: [] };
      }
      return {};
    });
    const app = await createApp();
    app.client = { request, stop: () => {} } as never;
    app.connected = true;
    app.tab = "config";
    app.configSettingsMode = "quick";
    await app.updateComplete;

    const manage = Array.from(app.renderRoot.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Manage",
    );
    expect(manage, "Manage button should render on the Model & Thinking card").toBeTruthy();

    manage!.click();
    await app.updateComplete;

    await vi.waitFor(async () => {
      await app.updateComplete;
      const dialog = app.renderRoot.querySelector("dialog.model-studio");
      expect(dialog, "Model Studio dialog should render after clicking Manage").toBeTruthy();
    });
    app.remove();
  });

  it("always lands on Quick Settings when Settings is opened from the nav", async () => {
    const request = vi.fn(async () => ({}));
    const app = await createApp();
    app.client = { request, stop: () => {} } as never;
    app.connected = true;
    // Reproduce the trap: user was left in advanced mode, then went to Channels.
    app.configSettingsMode = "advanced";
    app.tab = "channels";
    await app.updateComplete;

    const settingsNav = Array.from(
      app.renderRoot.querySelectorAll("a.settings-section-nav__item"),
    ).find((anchor) => anchor.textContent?.includes("Settings")) as HTMLAnchorElement | undefined;
    expect(settingsNav, "Settings pill should render on settings-group tabs").toBeTruthy();

    settingsNav!.click();
    await app.updateComplete;

    expect(app.tab).toBe("config");
    expect(app.configSettingsMode).toBe("quick");
    const manage = Array.from(app.renderRoot.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Manage",
    );
    expect(manage, "Quick Settings (with the Model Manage button) should be visible").toBeTruthy();
    app.remove();
  });
});
