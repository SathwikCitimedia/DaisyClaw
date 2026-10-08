import { html, render } from "lit";
import { describe, expect, it, vi } from "vitest";
import type { ChatItem } from "../types/chat-types.ts";
import { renderTurnSteps } from "./turn-steps-render.ts";

const item: Extract<ChatItem, { kind: "steps" }> = {
  kind: "steps",
  key: "steps:answer",
  summary: "Searched the web twice",
  timestamp: 1,
  groups: [
    {
      kind: "group",
      key: "group:tool:a",
      role: "tool",
      messages: [{ key: "a", message: { role: "toolResult", content: "x" } }],
      timestamp: 1,
      isStreaming: false,
    },
  ],
};

describe("folded reply steps", () => {
  it("is one closed line with the summary", () => {
    const host = document.createElement("div");
    const renderGroup = vi.fn(() => html`<div class="step"></div>`);
    render(renderTurnSteps(item, { open: false, onToggle: () => {}, renderGroup }), host);
    expect(host.querySelector(".chat-turn-steps__summary")?.textContent).toBe(
      "Searched the web twice",
    );
    expect(host.querySelector("button")?.getAttribute("aria-expanded")).toBe("false");
    expect(host.querySelector(".chat-turn-steps__body")).toBeNull();
    expect(renderGroup).not.toHaveBeenCalled();
  });

  it("opens to show each step and toggles from its button", () => {
    const host = document.createElement("div");
    const onToggle = vi.fn();
    render(
      renderTurnSteps(item, {
        open: true,
        onToggle,
        renderGroup: () => html`<div class="step">step</div>`,
      }),
      host,
    );
    expect(host.querySelectorAll(".chat-turn-steps__body .step")).toHaveLength(1);
    host.querySelector("button")?.click();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
