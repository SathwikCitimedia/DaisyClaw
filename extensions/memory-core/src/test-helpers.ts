// Memory Core helper module supports test helpers behavior.
import fs from "node:fs/promises";
import path from "node:path";
import { resolvePreferredDaisyClawTmpDir } from "daisyclaw/plugin-sdk/temp-path";
import { afterAll, beforeAll } from "vitest";
import {
  configureMemoryCoreDreamingStateForTests,
  resetMemoryCoreDreamingStateForTests,
} from "./dreaming-state.js";

export function createMemoryCoreTestHarness() {
  let fixtureRoot = "";
  let caseId = 0;

  beforeAll(async () => {
    await configureMemoryCoreDreamingStateForTests();
    fixtureRoot = await fs.mkdtemp(
      path.join(resolvePreferredDaisyClawTmpDir(), "memory-core-test-fixtures-"),
    );
  });

  afterAll(async () => {
    if (!fixtureRoot) {
      return;
    }
    await fs.rm(fixtureRoot, { recursive: true, force: true });
    resetMemoryCoreDreamingStateForTests();
  });

  async function createTempWorkspace(prefix: string): Promise<string> {
    const workspaceDir = path.join(fixtureRoot, `${prefix}${caseId++}`);
    await fs.mkdir(workspaceDir, { recursive: true });
    return workspaceDir;
  }

  return {
    createTempWorkspace,
  };
}
