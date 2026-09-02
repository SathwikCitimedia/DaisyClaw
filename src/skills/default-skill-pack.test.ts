import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { DaisyClawConfig } from "../config/types.daisyclaw.js";
import {
  DEFAULT_SKILL_PACK_CONNECT,
  DEFAULT_SKILL_PACK_HIDDEN,
  DEFAULT_SKILL_PACK_INSTANT,
  DEFAULT_SKILL_PACK_SELF_GATED,
  applyDefaultSkillPack,
  previewDefaultSkillPack,
} from "./default-skill-pack.js";

const BUNDLED_SKILLS_DIR = fileURLToPath(new URL("../../skills", import.meta.url));

describe("default skill pack", () => {
  it("covers every bundled skill exactly once", () => {
    const bundled = fs
      .readdirSync(BUNDLED_SKILLS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .toSorted();
    const pack = [
      ...DEFAULT_SKILL_PACK_INSTANT,
      ...DEFAULT_SKILL_PACK_CONNECT,
      ...DEFAULT_SKILL_PACK_SELF_GATED,
      ...DEFAULT_SKILL_PACK_HIDDEN,
    ];
    expect(pack.toSorted()).toEqual(bundled);
    expect(new Set(pack).size).toBe(pack.length);
  });

  it("hides all hidden-tier skills on a fresh config", () => {
    const { config, hidden } = applyDefaultSkillPack({});
    expect(hidden).toEqual([...DEFAULT_SKILL_PACK_HIDDEN]);
    for (const name of DEFAULT_SKILL_PACK_HIDDEN) {
      expect(config.skills?.entries?.[name]?.enabled).toBe(false);
    }
    for (const name of [...DEFAULT_SKILL_PACK_INSTANT, ...DEFAULT_SKILL_PACK_CONNECT]) {
      expect(config.skills?.entries?.[name]).toBeUndefined();
    }
  });

  it("never overrides an explicit user choice", () => {
    const cfg: DaisyClawConfig = {
      skills: { entries: { github: { enabled: true }, tmux: { enabled: false } } },
    };
    const { config, hidden } = applyDefaultSkillPack(cfg);
    expect(config.skills?.entries?.github?.enabled).toBe(true);
    expect(hidden).not.toContain("github");
    expect(hidden).not.toContain("tmux");
  });

  it("preserves other entry fields when hiding", () => {
    const cfg: DaisyClawConfig = {
      skills: { entries: { summarize: { apiKey: "sk-test" } } },
    };
    const { config } = applyDefaultSkillPack(cfg);
    expect(config.skills?.entries?.summarize).toEqual({ apiKey: "sk-test", enabled: false });
  });

  it("is idempotent", () => {
    const first = applyDefaultSkillPack({});
    const second = applyDefaultSkillPack(first.config);
    expect(second.hidden).toEqual([]);
    expect(second.config).toBe(first.config);
    expect(previewDefaultSkillPack(first.config).toHide).toEqual([]);
  });
});
