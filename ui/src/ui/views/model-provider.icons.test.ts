/* @vitest-environment jsdom */

import { render } from "lit";
import { describe, expect, it } from "vitest";
import { renderModelBrandIcon, resolveModelBrandKey } from "./model-provider.icons.ts";

describe("resolveModelBrandKey", () => {
  it("detects model families from id and name", () => {
    expect(resolveModelBrandKey({ id: "claude-sonnet-4-5", provider: "litellm" })).toBe("claude");
    expect(resolveModelBrandKey({ id: "gpt-oss-120b", provider: "groq" })).toBe("openai");
    expect(resolveModelBrandKey({ id: "llama-3.3-70b-versatile", provider: "groq" })).toBe("llama");
    expect(resolveModelBrandKey({ id: "qwen3-32b", provider: "groq" })).toBe("qwen");
    expect(resolveModelBrandKey({ id: "gemini-2.5-pro", provider: "google" })).toBe("gemini");
    expect(resolveModelBrandKey({ id: "deepseek-r1", provider: "openrouter" })).toBe("deepseek");
  });

  it("falls back to the provider when the family is unknown", () => {
    expect(resolveModelBrandKey({ id: "compound-beta", provider: "groq" })).toBe("groq");
    expect(resolveModelBrandKey({ id: "some-model", provider: "anthropic" })).toBe("anthropic");
  });

  it("returns null for unknown families and providers", () => {
    expect(resolveModelBrandKey({ id: "mystery-model", provider: "litellm" })).toBeNull();
  });
});

describe("renderModelBrandIcon", () => {
  it("renders a tinted tile with a glyph or monogram", () => {
    const container = document.createElement("div");
    render(renderModelBrandIcon({ id: "claude-sonnet-4-5", provider: "litellm" }), container);
    const tile = container.querySelector(".model-brand") as HTMLElement;
    expect(tile).toBeTruthy();
    expect(tile.getAttribute("style")).toContain("#CC785C");
    expect(tile.querySelector("svg.model-brand__glyph")).toBeTruthy();

    render(renderModelBrandIcon({ id: "qwen3-32b", provider: "groq" }), container);
    expect(container.querySelector(".model-brand__monogram")?.textContent).toBe("Q");
  });
});
