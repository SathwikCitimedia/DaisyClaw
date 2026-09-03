// Tool-bins tests cover skill tools-dir binary detection and exec PATH dirs.
import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DaisyClawTestState } from "../../test-utils/daisyclaw-test-state.js";
import { resolveConfigDir } from "../../utils.js";
import { createInstallDownloadTestState } from "../test-support/install-download-test-utils.js";
import { createCanonicalFixtureSkill } from "../test-support/test-helpers.js";
import type { SkillEntry } from "../types.js";
import {
  collectSkillToolPathDirs,
  createSkillBinChecker,
  hasSkillToolBinary,
} from "./tool-bins.js";
import { resolveSkillToolsRootDir } from "./tools-dir.js";

let testState: DaisyClawTestState | undefined;
let workspaceDir = "";

beforeAll(async () => {
  testState = await createInstallDownloadTestState();
  workspaceDir = testState.workspaceDir;
});

afterAll(async () => {
  await testState?.cleanup();
  testState = undefined;
});

function buildEntry(name: string): SkillEntry {
  const skillDir = path.join(workspaceDir, "skills", name);
  return {
    skill: createCanonicalFixtureSkill({
      name,
      description: `${name} test skill`,
      filePath: path.join(skillDir, "SKILL.md"),
      baseDir: skillDir,
      source: "daisyclaw-workspace",
    }),
    frontmatter: {},
  };
}

async function writeExecutable(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, "#!/bin/sh\nexit 0\n");
  await fs.chmod(filePath, 0o755);
}

describe("hasSkillToolBinary", () => {
  it("finds binaries in the tools root, bin/, and first-level subdirs", async () => {
    const entry = buildEntry("toolbin-locations");
    const root = resolveSkillToolsRootDir(entry);
    await writeExecutable(path.join(root, "roottool"));
    await writeExecutable(path.join(root, "bin", "bintool"));
    await writeExecutable(path.join(root, "release-v1", "nestedtool"));
    await writeExecutable(path.join(root, "ffmpeg-n8", "bin", "deeptool"));
    await writeExecutable(path.join(root, "mingit", "cmd", "cmdtool"));

    expect(hasSkillToolBinary(entry, "roottool")).toBe(true);
    expect(hasSkillToolBinary(entry, "bintool")).toBe(true);
    expect(hasSkillToolBinary(entry, "nestedtool")).toBe(true);
    expect(hasSkillToolBinary(entry, "deeptool")).toBe(true);
    expect(hasSkillToolBinary(entry, "cmdtool")).toBe(true);
    expect(hasSkillToolBinary(entry, "absent-tool")).toBe(false);
  });

  it("returns false when the skill has no tools directory", () => {
    expect(hasSkillToolBinary(buildEntry("toolbin-none"), "anything")).toBe(false);
  });

  it("resolves Windows executables via PATHEXT", async () => {
    if (process.platform !== "win32") {
      return;
    }
    const entry = buildEntry("toolbin-windows");
    const root = resolveSkillToolsRootDir(entry);
    await writeExecutable(path.join(root, "bin", "wintool.exe"));
    expect(hasSkillToolBinary(entry, "wintool")).toBe(true);
  });
});

describe("npm prefix detection", () => {
  it("finds bin shims installed under the managed npm prefix", async () => {
    const entry = buildEntry("toolbin-npm-prefix");
    const shimDir =
      process.platform === "win32"
        ? path.join(resolveConfigDir(), "tools", "node", "npm")
        : path.join(resolveConfigDir(), "tools", "node", "npm", "bin");
    await writeExecutable(path.join(shimDir, "npm-installed-tool"));

    expect(hasSkillToolBinary(entry, "npm-installed-tool")).toBe(true);
    expect(collectSkillToolPathDirs()).toContain(shimDir);
  });
});

describe("createSkillBinChecker", () => {
  it("accepts tools-dir binaries that are not on PATH", async () => {
    const entry = buildEntry("toolbin-checker");
    const root = resolveSkillToolsRootDir(entry);
    await writeExecutable(path.join(root, "bin", "daisyclaw-test-tool"));

    const checker = createSkillBinChecker(entry);
    expect(checker("daisyclaw-test-tool")).toBe(true);
    expect(checker("daisyclaw-not-installed-tool")).toBe(false);
  });
});

describe("collectSkillToolPathDirs", () => {
  it("lists existing skill tool roots and their bin subdirs", async () => {
    const entry = buildEntry("toolbin-pathdirs");
    const root = resolveSkillToolsRootDir(entry);
    await writeExecutable(path.join(root, "bin", "sometool"));

    const dirs = collectSkillToolPathDirs();
    expect(dirs).toContain(root);
    expect(dirs).toContain(path.join(root, "bin"));
    for (const dir of dirs) {
      expect(dir.startsWith(path.join(resolveConfigDir(), "tools"))).toBe(true);
    }
  });
});
