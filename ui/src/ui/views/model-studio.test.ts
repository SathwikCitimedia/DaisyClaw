// Control UI tests cover the Model Studio dialog rendering.
import { render } from "lit";
import { describe, expect, it, vi } from "vitest";
import { renderModelStudio, type ModelStudioProps } from "./model-studio.ts";

function createProps(overrides: Partial<ModelStudioProps> = {}): ModelStudioProps {
  return {
    open: true,
    loading: false,
    catalog: [
      { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", provider: "litellm" },
      { id: "llama-3.3-70b", name: "Llama 3.3 70B", provider: "groq" },
    ],
    authStatus: { ts: 1, providers: [] },
    defaultModel: { primary: "litellm/claude-sonnet-4-5", fallbacks: [] },
    busy: null,
    error: null,
    expandedProvider: null,
    onClose: () => {},
    onExpandProvider: () => {},
    onConnectProvider: () => {},
    onMakeDefault: () => {},
    onToggleFallback: () => {},
    onOpenAdvanced: () => {},
    ...overrides,
  };
}

describe("renderModelStudio", () => {
  it("renders nothing while closed", () => {
    const container = document.createElement("div");
    render(renderModelStudio(createProps({ open: false })), container);
    expect(container.querySelector("dialog")).toBeNull();
  });

  it("renders the default hero, model rows, and provider presets when open", () => {
    const container = document.createElement("div");
    render(renderModelStudio(createProps()), container);

    expect(container.querySelector("dialog")).not.toBeNull();
    expect(container.querySelector(".model-studio__hero-name")?.textContent?.trim()).toBe(
      "Claude Sonnet 4.5",
    );
    const rows = Array.from(container.querySelectorAll(".model-studio__row"));
    expect(rows).toHaveLength(2);
    expect(rows[0]?.querySelector(".model-studio__badge")?.textContent?.trim()).toBe("Default");
    expect(rows[1]?.textContent).toContain("Make default");

    const providers = Array.from(container.querySelectorAll(".model-studio__provider-name")).map(
      (el) => el.textContent?.trim(),
    );
    expect(providers).toEqual([
      "Anthropic",
      "OpenAI",
      "Google",
      "Groq",
      "OpenRouter",
      "Custom server",
    ]);
  });

  it("invokes callbacks from row and provider actions", () => {
    const onMakeDefault = vi.fn();
    const onExpandProvider = vi.fn();
    const container = document.createElement("div");
    render(renderModelStudio(createProps({ onMakeDefault, onExpandProvider })), container);

    const makeDefault = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Make default",
    );
    makeDefault!.click();
    expect(onMakeDefault).toHaveBeenCalledWith("groq/llama-3.3-70b");

    const anthropic = Array.from(container.querySelectorAll(".model-studio__provider-head")).find(
      (button) => button.textContent?.includes("Anthropic"),
    ) as HTMLButtonElement;
    anthropic.click();
    expect(onExpandProvider).toHaveBeenCalledWith("anthropic");
  });

  it("submits an API key through the connect form", () => {
    const onConnectProvider = vi.fn();
    const container = document.createElement("div");
    render(
      renderModelStudio(createProps({ expandedProvider: "groq", onConnectProvider })),
      container,
    );

    const input = container.querySelector<HTMLInputElement>('input[data-field="apiKey"]');
    expect(input).not.toBeNull();
    input!.value = "gsk_test";
    const save = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Save & connect",
    );
    save!.click();
    expect(onConnectProvider).toHaveBeenCalledWith("groq", { apiKey: "gsk_test" });
  });
});
