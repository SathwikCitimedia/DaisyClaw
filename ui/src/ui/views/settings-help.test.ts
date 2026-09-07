/* @vitest-environment jsdom */

import { render } from "lit";
import { describe, expect, it } from "vitest";
import {
  getSettingsHelpTopic,
  hasSettingsHelp,
  renderSettingsHelpDialog,
} from "./settings-help.ts";

const HELP_TABS = ["communications", "automation", "mcp", "infrastructure", "aiAgents"] as const;

describe("settings help topics", () => {
  it("provides a topic for every documented settings tab", () => {
    for (const tab of HELP_TABS) {
      expect(hasSettingsHelp(tab)).toBe(true);
      const topic = getSettingsHelpTopic(tab);
      expect(topic).not.toBeNull();
      expect(topic?.title.length).toBeGreaterThan(0);
      expect(topic?.intro.length).toBeGreaterThan(0);
      expect(topic?.sections.length).toBeGreaterThan(0);
    }
  });

  it("has no topic for undocumented tabs", () => {
    expect(hasSettingsHelp("chat")).toBe(false);
    expect(hasSettingsHelp("skills")).toBe(false);
    expect(getSettingsHelpTopic("chat")).toBeNull();
  });

  it("appends the shared toolbar section to every topic", () => {
    for (const tab of HELP_TABS) {
      const sections = getSettingsHelpTopic(tab)?.sections ?? [];
      const last = sections[sections.length - 1];
      expect(last?.heading).toBe("The buttons on top");
      expect(last?.entries?.map((e) => e.term)).toContain("Apply");
    }
  });

  it("keeps every entry and example step non-empty", () => {
    for (const tab of HELP_TABS) {
      const topic = getSettingsHelpTopic(tab);
      for (const section of topic?.sections ?? []) {
        for (const entry of section.entries ?? []) {
          expect(entry.term.trim().length).toBeGreaterThan(0);
          expect(entry.text.trim().length).toBeGreaterThan(0);
        }
        for (const step of section.example?.steps ?? []) {
          expect(step.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("renderSettingsHelpDialog", () => {
  it("renders the topic content into a dialog", () => {
    if (!HTMLDialogElement.prototype.showModal) {
      HTMLDialogElement.prototype.showModal = function showModal() {
        this.setAttribute("open", "");
      };
    }
    const host = document.createElement("div");
    render(
      renderSettingsHelpDialog("aiAgents", () => {}),
      host,
    );
    const text = host.textContent?.replace(/\s+/g, " ") ?? "";
    expect(text).toContain("AI & Agents");
    expect(text).toContain("How to use this page");
    expect(text).toContain("The buttons on top");
    expect(host.querySelector("dialog.settings-help-dialog")).not.toBeNull();
  });

  it("renders nothing for an undocumented tab", () => {
    const host = document.createElement("div");
    render(
      renderSettingsHelpDialog("chat", () => {}),
      host,
    );
    expect(host.querySelector("dialog")).toBeNull();
  });
});
