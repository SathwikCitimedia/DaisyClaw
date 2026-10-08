import { render } from "lit";
import { describe, expect, it, vi } from "vitest";
import {
  isApplePlatform,
  isKeyboardShortcutsHotkey,
  paletteShortcutLabel,
  renderKeyboardShortcutsDialog,
  resolveShortcutKeys,
} from "./keyboard-shortcuts.ts";

const windows = { platform: "Win32", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" };
const mac = { platform: "MacIntel", userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)" };

describe("keyboard shortcut labels", () => {
  it("uses Ctrl on Windows and ⌘ on a Mac", () => {
    expect(isApplePlatform(windows)).toBe(false);
    expect(isApplePlatform(mac)).toBe(true);
    expect(isApplePlatform({ userAgentData: { platform: "macOS" } })).toBe(true);
    expect(paletteShortcutLabel(windows)).toBe("Ctrl K");
    expect(paletteShortcutLabel(mac)).toBe("⌘K");
    expect(resolveShortcutKeys(["mod", "F"], windows)).toEqual(["Ctrl", "F"]);
    expect(resolveShortcutKeys(["mod", "F"], mac)).toEqual(["⌘", "F"]);
  });

  it("opens on Ctrl+/ or ⌘/ only", () => {
    const key = (init: KeyboardEventInit) => new KeyboardEvent("keydown", init);
    expect(isKeyboardShortcutsHotkey(key({ key: "/", ctrlKey: true }))).toBe(true);
    expect(isKeyboardShortcutsHotkey(key({ key: "/", metaKey: true }))).toBe(true);
    expect(isKeyboardShortcutsHotkey(key({ key: "/" }))).toBe(false);
    expect(isKeyboardShortcutsHotkey(key({ key: "/", ctrlKey: true, altKey: true }))).toBe(false);
  });
});

describe("keyboard shortcuts sheet", () => {
  it("renders nothing while closed", () => {
    const container = document.createElement("div");
    render(renderKeyboardShortcutsDialog({ open: false, onClose: () => {} }), container);
    expect(container.querySelector(".shortcuts-sheet")).toBeNull();
  });

  it("lists the shortcuts and closes from its button", () => {
    const onClose = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    render(renderKeyboardShortcutsDialog({ open: true, onClose }), container);
    const rows = [...container.querySelectorAll<HTMLElement>(".shortcuts-sheet__row")];
    expect(rows.map((row) => row.dataset.shortcut)).toEqual([
      "search",
      "shortcuts",
      "send",
      "newline",
      "history",
      "commands",
      "find",
    ]);
    expect(rows[0].querySelector(".shortcuts-sheet__label")?.textContent).toBe(
      "Search chats and commands",
    );
    container.querySelector<HTMLButtonElement>(".exec-approval-header button")?.click();
    expect(onClose).toHaveBeenCalledTimes(1);
    container.remove();
  });
});
