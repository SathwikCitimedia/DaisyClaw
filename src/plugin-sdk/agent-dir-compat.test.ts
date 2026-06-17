/**
 * Tests agent directory compatibility helpers.
 */
import { describe, expect, it } from "vitest";
import { resolveDaisyClawAgentDir } from "./agent-dir-compat.js";

describe("resolveDaisyClawAgentDir", () => {
  it("keeps the shipped Pi env alias for deprecated plugin SDK callers", () => {
    expect(
      resolveDaisyClawAgentDir({
        PI_CODING_AGENT_DIR: "/tmp/daisyclaw-legacy-agent",
      }),
    ).toBe("/tmp/daisyclaw-legacy-agent");
  });

  it("prefers the DaisyClaw env override over the deprecated Pi alias", () => {
    expect(
      resolveDaisyClawAgentDir({
        DAISYCLAW_AGENT_DIR: "/tmp/daisyclaw-agent",
        PI_CODING_AGENT_DIR: "/tmp/daisyclaw-legacy-agent",
      }),
    ).toBe("/tmp/daisyclaw-agent");
  });
});
