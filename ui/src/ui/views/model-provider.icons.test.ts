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
  it("renders the official logo on a neutral tile when one exists", () => {
    const container = document.createElement("div");
    for (const entry of [
      { id: "claude-sonnet-4-5", provider: "litellm" },
      { id: "gpt-oss-120b", provider: "groq" },
      { id: "gemini-2.5-pro", provider: "google" },
      { id: "grok-4", provider: "xai" },
      { id: "llama-3.3-70b-versatile", provider: "groq" },
      { id: "mistral-large-latest", provider: "mistral" },
      { id: "deepseek-r1", provider: "openrouter" },
      { id: "qwen3-32b", provider: "groq" },
    ]) {
      render(renderModelBrandIcon(entry), container);
      const tile = container.querySelector(".model-brand") as HTMLElement;
      expect(tile, entry.id).toBeTruthy();
      expect(tile.classList.contains("model-brand--logo"), entry.id).toBe(true);
      // Official marks keep their own colors, so no brand tint is applied.
      expect(tile.getAttribute("style"), entry.id).toBeNull();
      expect(tile.querySelector("svg"), entry.id).toBeTruthy();
    }
  });

  it("gives Kimi a fixed plate because its glyph is white", () => {
    const container = document.createElement("div");
    render(renderModelBrandIcon({ id: "kimi-k2-instruct", provider: "groq" }), container);
    const tile = container.querySelector(".model-brand") as HTMLElement;
    expect(tile.classList.contains("model-brand--plate")).toBe(true);
    expect(tile.getAttribute("style")).toContain("--model-brand-plate");
    expect(tile.querySelector("svg")).toBeTruthy();
  });

  it("keeps the tinted glyph tile for families without an official logo", () => {
    const container = document.createElement("div");
    render(renderModelBrandIcon({ id: "mystery-model", provider: "litellm" }), container);
    const tile = container.querySelector(".model-brand") as HTMLElement;
    expect(tile.classList.contains("model-brand--logo")).toBe(false);
    expect(tile.querySelector("svg.model-brand__glyph")).toBeTruthy();
  });

  it("tints the Groq mark, which is drawn with currentColor", () => {
    const container = document.createElement("div");
    render(renderModelBrandIcon({ id: "compound-beta", provider: "groq" }), container);
    const tile = container.querySelector(".model-brand") as HTMLElement;
    expect(tile.classList.contains("model-brand--logo")).toBe(true);
    expect(tile.classList.contains("model-brand--plate")).toBe(false);
    expect(tile.getAttribute("style")).toContain("#F55036");
    expect(tile.querySelector("svg")).toBeTruthy();
  });

  it("keeps Groq and Grok on separate marks", () => {
    const container = document.createElement("div");
    render(renderModelBrandIcon({ id: "compound-beta", provider: "groq" }), container);
    const groqPath = container.querySelector("svg path")?.getAttribute("d");
    render(renderModelBrandIcon({ id: "grok-4", provider: "xai" }), container);
    const grokPath = container.querySelector("svg path")?.getAttribute("d");
    expect(groqPath).toBeTruthy();
    expect(grokPath).toBeTruthy();
    expect(groqPath).not.toBe(grokPath);
  });
});
