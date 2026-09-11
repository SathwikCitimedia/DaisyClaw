// Control UI tests cover navigation groups behavior.
import { describe, expect, it } from "vitest";
import {
  SETTINGS_ROW_TABS,
  SETTINGS_TABS,
  TAB_GROUPS,
  isSettingsTab,
  isSidebarTabVisible,
  isTabInGroup,
  pathForTab,
  resolveVisibleSidebarTabs,
  tabFromPath,
} from "./navigation.ts";

describe("TAB_GROUPS", () => {
  it("collapses detailed settings slices into one sidebar entry", () => {
    const settings = TAB_GROUPS.find((group) => group.label === "settings");
    expect(settings?.tabs).toEqual(["config"]);
    expect(SETTINGS_TABS.every((tab) => isSettingsTab(tab))).toBe(true);
  });

  it("keeps developer-grade slices out of the settings row while staying routable", () => {
    // AI & Agents / Infrastructure are the same editor as Settings → Advanced,
    // and Debug is a raw RPC console: none belong in an everyday settings row.
    for (const tab of ["aiAgents", "infrastructure", "debug"] as const) {
      expect(SETTINGS_ROW_TABS).not.toContain(tab);
      // Still in the settings family and reachable by URL for support.
      expect(SETTINGS_TABS).toContain(tab);
      expect(isSettingsTab(tab)).toBe(true);
      expect(tabFromPath(pathForTab(tab, ""), "")).toBe(tab);
    }
  });

  it("shows only the everyday settings tabs in the row", () => {
    expect([...SETTINGS_ROW_TABS]).toEqual([
      "config",
      "channels",
      "communications",
      "appearance",
      "automation",
      "mcp",
      "logs",
    ]);
  });

  it("keeps channel management out of the primary control sidebar", () => {
    const control = TAB_GROUPS.find((group) => group.label === "control");
    expect(control?.tabs).toEqual([
      "overview",
      "activity",
      "workboard",
      "instances",
      "sessions",
      "usage",
      "cron",
    ]);
    expect(SETTINGS_TABS).toContain("channels");
  });

  it("hides the workboard tab from the sidebar until its plugin is enabled", () => {
    const control = TAB_GROUPS.find((group) => group.label === "control");
    const tabs = control?.tabs ?? [];
    expect(resolveVisibleSidebarTabs(tabs, { enabledPluginIds: new Set() })).toEqual([
      "overview",
      "activity",
      "instances",
      "sessions",
      "usage",
      "cron",
    ]);
    expect(resolveVisibleSidebarTabs(tabs, { enabledPluginIds: new Set(["workboard"]) })).toEqual([
      ...tabs,
    ]);
    // Only plugin-gated tabs are affected; everything else is always visible.
    expect(isSidebarTabVisible("chat", { enabledPluginIds: new Set() })).toBe(true);
    expect(isSidebarTabVisible("workboard", { enabledPluginIds: new Set() })).toBe(false);
  });

  it("keeps the settings group active for nested settings routes", () => {
    const settings = TAB_GROUPS.find((group) => group.label === "settings");
    if (!settings) {
      throw new Error("Expected settings group");
    }

    expect(isTabInGroup(settings, "appearance")).toBe(true);
    expect(isTabInGroup(settings, "channels")).toBe(true);
    expect(isTabInGroup(settings, "debug")).toBe(true);
    expect(isTabInGroup(settings, "chat")).toBe(false);
  });

  it("routes every published settings slice", () => {
    expect(tabFromPath("/communications")).toBe("communications");
    expect(tabFromPath("/appearance")).toBe("appearance");
    expect(tabFromPath("/automation")).toBe("automation");
    expect(tabFromPath("/infrastructure")).toBe("infrastructure");
    expect(tabFromPath("/ai-agents")).toBe("aiAgents");
    expect(tabFromPath("/config")).toBe("config");
    expect(tabFromPath("/channels")).toBe("channels");
  });
});
