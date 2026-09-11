/* @vitest-environment jsdom */

import { render } from "lit";
import { describe, expect, it, vi } from "vitest";
import { renderQuickSettings, type QuickSettingsProps } from "./config-quick.ts";

function expectButtonByText(container: Element, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Expected button labelled ${text}`);
  }
  return button;
}

function expectRowByLabel(container: Element, text: string): HTMLElement {
  const row = Array.from(container.querySelectorAll<HTMLElement>(".qs-row")).find(
    (candidate) => candidate.querySelector(".qs-row__label")?.textContent?.trim() === text,
  );
  if (!(row instanceof HTMLElement)) {
    throw new Error(`Expected quick settings row "${text}"`);
  }
  return row;
}

function expectFileInput(input: Element | null | undefined): HTMLInputElement {
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("Expected file input");
  }
  return input;
}

function createProps(overrides: Partial<QuickSettingsProps> = {}): QuickSettingsProps {
  return {
    currentModel: "gpt-5.5",
    thinkingLevel: "off",
    fastMode: false,
    onModelChange: vi.fn(),
    onThinkingChange: vi.fn(),
    onFastModeToggle: vi.fn(),
    channels: [],
    onChannelConfigure: vi.fn(),
    automation: {
      cronJobCount: 0,
      skillCount: 0,
      mcpServerCount: 0,
    },
    onManageCron: vi.fn(),
    onBrowseSkills: vi.fn(),
    onConfigureMcp: vi.fn(),
    security: {
      gatewayAuth: "Unknown",
      execPolicy: "Allowlist",
      deviceAuth: true,
      browserEnabled: true,
      toolProfile: "coding",
    },
    onSecurityConfigure: vi.fn(),
    onBrowserEnabledToggle: vi.fn(),
    onToolProfileChange: vi.fn(),
    themeMode: "system",
    borderRadius: 50,
    textScale: 100,
    setThemeMode: vi.fn(),
    setBorderRadius: vi.fn(),
    setTextScale: vi.fn(),
    userAvatar: null,
    onUserAvatarChange: vi.fn(),
    configObject: {},
    onSelectPreset: vi.fn(),
    onAdvancedSettings: vi.fn(),
    connected: true,
    gatewayUrl: "ws://localhost:18789",
    assistantName: "DaisyClaw",
    assistantAvatar: null,
    assistantAvatarUrl: null,
    assistantAvatarSource: null,
    assistantAvatarStatus: null,
    assistantAvatarReason: null,
    assistantAvatarOverride: null,
    assistantAvatarUploadBusy: false,
    assistantAvatarUploadError: null,
    onAssistantAvatarOverrideChange: vi.fn(),
    onAssistantAvatarClearOverride: vi.fn(),
    basePath: "",
    version: "2026.4.22",
    ...overrides,
  };
}

function collectQuickSettingsCardKinds(container: Element): string[] {
  const kinds: string[] = [];
  for (const card of container.querySelectorAll(".qs-card")) {
    const kind = Array.from(card.classList).find(
      (className) => className.startsWith("qs-card--") && className !== "qs-card--span-all",
    );
    if (kind) {
      kinds.push(kind);
    }
  }
  return kinds;
}

function expectAssistantAvatarSource(container: Element): { label: string; source: string } {
  const source = container.querySelector(".qs-identity-card--assistant .qs-identity-card__source");
  return {
    label: source?.querySelector("span")?.textContent?.trim() ?? "",
    source: source?.querySelector("code")?.textContent?.trim() ?? "",
  };
}

describe("renderQuickSettings", () => {
  it("uses direct dashboard cards for the compact settings layout", () => {
    const container = document.createElement("div");

    render(renderQuickSettings(createProps()), container);

    expect(collectQuickSettingsCardKinds(container)).toEqual([
      "qs-card--model",
      "qs-card--channels",
      "qs-card--security",
      "qs-card--personal",
      "qs-card--appearance",
      "qs-card--automations",
      "qs-card--reset",
    ]);
    expect(container.querySelectorAll(".qs-side-stack .qs-card")).toHaveLength(2);
    expect(container.querySelectorAll(".qs-card--span-all")).toHaveLength(1);
  });

  it("shows the current bootstrap default when config omits the explicit limit", () => {
    const container = document.createElement("div");

    render(renderQuickSettings(createProps({ configObject: {} })), container);

    const stat = Array.from(container.querySelectorAll<HTMLElement>(".qs-profile-stat")).find(
      (candidate) =>
        candidate.querySelector(".qs-profile-stat__label")?.textContent?.trim() ===
        "Bootstrap Per File",
    );
    expect(stat?.querySelector(".qs-profile-stat__value")?.textContent?.trim()).toBe(
      "20,000 chars",
    );
  });

  it("lets operators change browser and tool profile from Security quick settings", () => {
    const onBrowserEnabledToggle = vi.fn();
    const onToolProfileChange = vi.fn();
    const container = document.createElement("div");

    render(
      renderQuickSettings(
        createProps({
          security: {
            gatewayAuth: "token",
            execPolicy: "allowlist",
            deviceAuth: true,
            browserEnabled: false,
            toolProfile: "messaging",
          },
          onBrowserEnabledToggle,
          onToolProfileChange,
        }),
      ),
      container,
    );

    const browserRow = expectRowByLabel(container, "Browser enabled");
    expect(browserRow.querySelector(".qs-toggle__hint")?.textContent).toBe("Disabled");
    const browserInput = browserRow.querySelector("input");
    expect(browserInput).toBeInstanceOf(HTMLInputElement);
    expect((browserInput as HTMLInputElement).checked).toBe(false);

    (browserInput as HTMLInputElement).checked = true;
    browserInput?.dispatchEvent(new Event("change"));
    expect(onBrowserEnabledToggle).toHaveBeenCalledWith(true);

    expectButtonByText(container, "full").click();
    expect(onToolProfileChange).toHaveBeenCalledWith("full");
    expect([...expectButtonByText(container, "messaging").classList]).toEqual([
      "qs-segmented__btn",
      "qs-segmented__btn--compact",
      "qs-segmented__btn--active",
    ]);
  });

  it("lets operators change text size from Appearance quick settings", () => {
    const setTextScale = vi.fn();
    const container = document.createElement("div");

    render(renderQuickSettings(createProps({ textScale: 125, setTextScale })), container);

    const textSizeRow = expectRowByLabel(container, "Text size");
    const active = Array.from(textSizeRow.querySelectorAll("button")).find((button) =>
      button.classList.contains("qs-segmented__btn--active"),
    );
    expect(active?.textContent?.trim()).toBe("XL");

    expectButtonByText(textSizeRow, "XXL").click();
    expect(setTextScale).toHaveBeenCalledWith(140);
  });

  it("keeps the local user name fixed and shows the assistant identity", () => {
    const container = document.createElement("div");

    render(
      renderQuickSettings(
        createProps({
          assistantName: "Nova",
          assistantAvatar: "assets/avatars/nova-portrait.png",
          assistantAvatarUrl: "blob:nova",
        }),
      ),
      container,
    );

    const titles = Array.from(container.querySelectorAll(".qs-identity-card__title")).map((node) =>
      node.textContent?.trim(),
    );
    expect(titles).toEqual(["You", "Nova"]);
    expect(container.querySelector('input[placeholder="You"]')).toBeNull();
    expect(
      Array.from(container.querySelectorAll(".qs-row__label")).some(
        (node) => node.textContent?.trim() === "Name",
      ),
    ).toBe(false);
    expect(container.querySelector(".qs-assistant-avatar")?.getAttribute("src")).toBe("blob:nova");
  });

  it("renders same-origin assistant avatar routes from IDENTITY.md", () => {
    const container = document.createElement("div");

    render(
      renderQuickSettings(
        createProps({
          assistantName: "Nova",
          assistantAvatar: "/avatar/main",
          assistantAvatarUrl: "/avatar/main",
          assistantAvatarSource: "assets/avatars/nova-portrait.png",
          assistantAvatarStatus: "local",
        }),
      ),
      container,
    );

    expect(container.querySelector(".qs-assistant-avatar")?.getAttribute("src")).toBe(
      "/avatar/main",
    );
  });

  it("shows the IDENTITY.md avatar source when the assistant falls back to the logo", () => {
    const container = document.createElement("div");

    render(
      renderQuickSettings(
        createProps({
          assistantName: "Nova",
          assistantAvatar: "/avatar/main",
          assistantAvatarUrl: null,
          assistantAvatarSource: "assets/avatars/nova-portrait.png",
          assistantAvatarStatus: "none",
          assistantAvatarReason: "missing",
        }),
      ),
      container,
    );

    expect(container.querySelector(".qs-assistant-avatar")?.getAttribute("src")).toBe(
      "/apple-touch-icon.png",
    );
    expect(expectAssistantAvatarSource(container)).toEqual({
      label: "IDENTITY.md",
      source: "assets/avatars/nova-portrait.png",
    });
    expect(container.querySelector(".qs-identity-card__issue")?.textContent?.trim()).toBe(
      "File not found",
    );
    expect(
      Array.from(container.querySelectorAll("label.btn")).some(
        (label) => label.textContent?.trim() === "Choose image",
      ),
    ).toBe(true);
  });

  it("reads assistant image imports into an override", () => {
    const onAssistantAvatarOverrideChange = vi.fn();
    const readAsDataURL = vi.fn(function (this: FileReader) {
      Object.defineProperty(this, "result", {
        configurable: true,
        value: "data:image/png;base64,YXZhdGFy",
      });
      this.dispatchEvent(new Event("load"));
    });
    class MockFileReader {
      result: string | null = null;
      listeners = new Map<string, Array<(event: Event) => void>>();
      addEventListener(type: string, listener: (event: Event) => void) {
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
      }
      dispatchEvent(event: Event) {
        for (const listener of this.listeners.get(event.type) ?? []) {
          listener(event);
        }
        return true;
      }
      readAsDataURL = readAsDataURL;
    }
    vi.stubGlobal("FileReader", MockFileReader);

    try {
      const container = document.createElement("div");
      render(
        renderQuickSettings(
          createProps({
            assistantAvatarSource: "assets/avatars/nova-portrait.png",
            assistantAvatarStatus: "none",
            assistantAvatarReason: "missing",
            onAssistantAvatarOverrideChange,
          }),
        ),
        container,
      );

      const inputs = Array.from(container.querySelectorAll('input[type="file"]'));
      const input = inputs.find((node) =>
        node.closest(".qs-identity-card--assistant"),
      ) as HTMLInputElement | null;
      expect(input?.type).toBe("file");
      if (!input) {
        throw new Error("expected assistant avatar file input");
      }

      Object.defineProperty(input, "files", {
        configurable: true,
        value: [new File(["avatar"], "avatar.png", { type: "image/png" })],
      });
      input.dispatchEvent(new Event("change"));

      expect(readAsDataURL).toHaveBeenCalledTimes(1);
      expect(onAssistantAvatarOverrideChange).toHaveBeenCalledWith(
        "data:image/png;base64,YXZhdGFy",
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("can clear an assistant avatar override back to IDENTITY.md", () => {
    const onAssistantAvatarClearOverride = vi.fn();
    const container = document.createElement("div");

    render(
      renderQuickSettings(
        createProps({
          assistantAvatar: "data:image/png;base64,b3ZlcnJpZGU=",
          assistantAvatarUrl: "data:image/png;base64,b3ZlcnJpZGU=",
          assistantAvatarSource: "data:image/png;base64,...",
          assistantAvatarStatus: "data",
          assistantAvatarOverride: "data:image/png;base64,b3ZlcnJpZGU=",
          onAssistantAvatarClearOverride,
        }),
      ),
      container,
    );

    expect(expectAssistantAvatarSource(container)).toEqual({
      label: "UI override",
      source: "data:image/png;base64,...",
    });
    expectButtonByText(container, "Clear override").dispatchEvent(new Event("click"));

    expect(onAssistantAvatarClearOverride).toHaveBeenCalledTimes(1);
  });

  it("lets the browser-local assistant avatar override stale missing IDENTITY.md metadata", () => {
    const dataUrl = "data:image/png;base64,bG9jYWwtYXNzaXN0YW50";
    const container = document.createElement("div");

    render(
      renderQuickSettings(
        createProps({
          assistantName: "Nova",
          assistantAvatar: "/avatar/main",
          assistantAvatarUrl: null,
          assistantAvatarSource: "avatars/missing.png",
          assistantAvatarStatus: "none",
          assistantAvatarReason: "missing",
          assistantAvatarOverride: dataUrl,
        }),
      ),
      container,
    );

    expect(container.querySelector(".qs-assistant-avatar")?.getAttribute("src")).toBe(dataUrl);
    expect(expectAssistantAvatarSource(container)).toEqual({
      label: "UI override",
      source: "data:image/png;base64,...",
    });
    expect(container.querySelector(".qs-identity-card__issue")).toBeNull();
    expect(
      Array.from(container.querySelectorAll("label.btn")).some(
        (label) => label.textContent?.trim() === "Replace image",
      ),
    ).toBe(true);
    expect(
      Array.from(container.querySelectorAll("button")).some(
        (button) => button.textContent?.trim() === "Clear override",
      ),
    ).toBe(true);
  });

  it("rejects oversized avatar uploads before reading them", () => {
    const onUserAvatarChange = vi.fn();
    const fileReader = vi.fn();
    vi.stubGlobal("FileReader", fileReader);

    try {
      const container = document.createElement("div");
      render(renderQuickSettings(createProps({ onUserAvatarChange })), container);

      const input = expectFileInput(
        Array.from(container.querySelectorAll('input[type="file"]')).find(
          (node) => !node.closest(".qs-identity-card--assistant"),
        ),
      );

      const file = new File([new Uint8Array(1_500_001)], "avatar.png", { type: "image/png" });
      Object.defineProperty(input, "files", {
        configurable: true,
        value: [file],
      });

      input.dispatchEvent(new Event("change"));

      expect(fileReader).not.toHaveBeenCalled();
      expect(onUserAvatarChange).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("model & thinking capability gating", () => {
  it("shows thinking levels and fast mode when the model supports them", () => {
    const container = document.createElement("div");
    render(
      renderQuickSettings(createProps({ thinkingSupported: true, fastModeSupported: true })),
      container,
    );

    const thinking = expectRowByLabel(container, "Thinking");
    expect(thinking.querySelectorAll(".qs-segmented__btn")).toHaveLength(4);
    expect(expectRowByLabel(container, "Fast mode")).toBeTruthy();
  });

  it("marks thinking unavailable instead of offering levels that do nothing", () => {
    const container = document.createElement("div");
    render(renderQuickSettings(createProps({ thinkingSupported: false })), container);

    const thinking = expectRowByLabel(container, "Thinking");
    expect(thinking.querySelectorAll(".qs-segmented__btn")).toHaveLength(0);
    expect(thinking.textContent).toContain("Not available for this model");
  });

  it("hides fast mode for providers that ignore it", () => {
    const container = document.createElement("div");
    render(renderQuickSettings(createProps({ fastModeSupported: false })), container);

    expect(() => expectRowByLabel(container, "Fast mode")).toThrow();
  });

  it("describes fast mode as capacity, not a cheaper model", () => {
    const container = document.createElement("div");
    render(
      renderQuickSettings(createProps({ fastMode: true, fastModeSupported: true })),
      container,
    );

    const hint = expectRowByLabel(container, "Fast mode").textContent ?? "";
    expect(hint).toContain("faster capacity");
    expect(hint).not.toContain("less capable");
  });
});

describe("quick settings diagnostics card", () => {
  it("stays hidden when the host offers no support bundle action", () => {
    const container = document.createElement("div");
    render(renderQuickSettings(createProps()), container);
    expect(container.querySelector("[data-qs-diagnostics]")).toBeNull();
  });

  it("collects a support report and shows where it landed", () => {
    const onCreateSupportBundle = vi.fn();
    const container = document.createElement("div");
    render(renderQuickSettings(createProps({ onCreateSupportBundle })), container);
    const button = container.querySelector<HTMLButtonElement>("[data-qs-support-bundle]");
    expect(button).toBeTruthy();
    button?.click();
    expect(onCreateSupportBundle).toHaveBeenCalledTimes(1);

    render(
      renderQuickSettings(
        createProps({
          onCreateSupportBundle,
          supportBundleResult: { ok: true, message: "Saved to C:/reports/daisy.zip" },
        }),
      ),
      container,
    );
    expect(container.querySelector("[data-qs-support-bundle-result]")?.textContent).toContain(
      "C:/reports/daisy.zip",
    );
  });
});

describe("quick settings reset card", () => {
  it("starts collapsed with 'Run setup again' and 'Reset Daisy…' actions", () => {
    const onRunSetupAgain = vi.fn();
    const onResetOpenChange = vi.fn();
    const container = document.createElement("div");
    render(renderQuickSettings(createProps({ onRunSetupAgain, onResetOpenChange })), container);
    expect(container.querySelector("[data-qs-reset]")).toBeTruthy();
    expect(container.querySelector("[data-qs-reset-confirm]")).toBeNull();
    expectButtonByText(container, "Run setup again").click();
    expect(onRunSetupAgain).toHaveBeenCalledTimes(1);
    expectButtonByText(container, "Reset Daisy…").click();
    expect(onResetOpenChange).toHaveBeenCalledWith(true);
  });

  it("lists what is erased and keeps the red confirm disabled until acknowledged", () => {
    const onFactoryReset = vi.fn();
    const onResetAcknowledgedChange = vi.fn();
    const container = document.createElement("div");
    render(
      renderQuickSettings(
        createProps({ resetOpen: true, onFactoryReset, onResetAcknowledgedChange }),
      ),
      container,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Every chat and its history");
    expect(text).toContain("Connected channels");
    expect(text).toContain("cannot be undone");
    const confirm = container.querySelector<HTMLButtonElement>("[data-qs-reset-confirm]");
    expect(confirm).toBeTruthy();
    expect(confirm?.disabled).toBe(true);
    expect(confirm?.classList.contains("danger")).toBe(true);
    confirm?.click();
    expect(onFactoryReset).not.toHaveBeenCalled();

    const ack = container.querySelector<HTMLInputElement>("[data-qs-reset-ack]");
    expect(ack).toBeTruthy();
    if (ack) {
      ack.checked = true;
      ack.dispatchEvent(new Event("change"));
    }
    expect(onResetAcknowledgedChange).toHaveBeenCalledWith(true);
  });

  it("fires the reset once acknowledged and shows progress while busy", () => {
    const onFactoryReset = vi.fn();
    const container = document.createElement("div");
    render(
      renderQuickSettings(
        createProps({ resetOpen: true, resetAcknowledged: true, onFactoryReset }),
      ),
      container,
    );
    const confirm = container.querySelector<HTMLButtonElement>("[data-qs-reset-confirm]");
    expect(confirm?.disabled).toBe(false);
    expect(confirm?.textContent?.trim()).toBe("Erase everything and start over");
    confirm?.click();
    expect(onFactoryReset).toHaveBeenCalledTimes(1);

    render(
      renderQuickSettings(
        createProps({
          resetOpen: true,
          resetAcknowledged: true,
          factoryResetBusy: true,
          onFactoryReset,
        }),
      ),
      container,
    );
    const busy = container.querySelector<HTMLButtonElement>("[data-qs-reset-confirm]");
    expect(busy?.disabled).toBe(true);
    expect(busy?.textContent?.trim()).toBe("Resetting…");
  });
});
