/**
 * Tests cron-triggered tool assembly.
 * Ensures cron runs scope cron tool behavior to self-removal of the current
 * job only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnyAgentTool } from "./tools/common.js";

const mocks = vi.hoisted(() => {
  const stubTool = (name: string) =>
    ({
      name,
      label: name,
      displaySummary: name,
      description: name,
      parameters: { type: "object", properties: {} },
      execute: vi.fn(),
    }) satisfies AnyAgentTool;

  return {
    createDaisyClawToolsOptions: vi.fn(),
    stubTool,
  };
});

vi.mock("./daisyclaw-tools.js", () => ({
  createDaisyClawTools: (options: unknown) => {
    mocks.createDaisyClawToolsOptions(options);
    return [mocks.stubTool("cron")];
  },
}));

import "./test-helpers/fast-bash-tools.js";
import "./test-helpers/fast-coding-tools.js";
import { createDaisyClawCodingTools } from "./agent-tools.js";

function firstDaisyClawToolsOptions(): { cronSelfRemoveOnlyJobId?: string } | undefined {
  return mocks.createDaisyClawToolsOptions.mock.calls[0]?.[0] as
    | { cronSelfRemoveOnlyJobId?: string }
    | undefined;
}

describe("createDaisyClawCodingTools cron scope", () => {
  beforeEach(() => {
    mocks.createDaisyClawToolsOptions.mockClear();
  });

  it("scopes cron-triggered jobs to self-removal", () => {
    const tools = createDaisyClawCodingTools({
      trigger: "cron",
      jobId: "job-current",
    });

    expect(tools.map((tool) => tool.name)).toContain("cron");
    expect(firstDaisyClawToolsOptions()?.cronSelfRemoveOnlyJobId).toBe("job-current");
  });

  it("does not scope non-cron sessions", () => {
    createDaisyClawCodingTools({
      trigger: "user",
      jobId: "job-current",
    });

    expect(firstDaisyClawToolsOptions()?.cronSelfRemoveOnlyJobId).toBeUndefined();
  });
});
