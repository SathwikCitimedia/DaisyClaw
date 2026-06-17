// Failure output tests cover CLI error formatting and failure summaries.
import { describe, expect, it } from "vitest";
import { formatCliFailureLines } from "./failure-output.js";

describe("formatCliFailureLines", () => {
  it("shows a concise reason and recovery commands by default", () => {
    const lines = formatCliFailureLines({
      title: "Could not start the CLI.",
      error: new Error("config file is invalid"),
      argv: ["node", "daisyclaw", "status"],
      env: {},
    });

    expect(lines).toEqual([
      "[daisyclaw] Could not start the CLI.",
      "[daisyclaw] Reason: config file is invalid",
      "[daisyclaw] Debug: set DAISYCLAW_DEBUG=1 to include the stack trace.",
      "[daisyclaw] Try: daisyclaw doctor",
      "[daisyclaw] Help: daisyclaw --help",
    ]);
  });

  it("prints stack details when debug output is requested", () => {
    const lines = formatCliFailureLines({
      title: "The CLI command failed.",
      error: new Error("boom"),
      env: { DAISYCLAW_DEBUG: "1" },
    });

    expect(lines.slice(0, 4)).toEqual([
      "[daisyclaw] The CLI command failed.",
      "[daisyclaw] Reason: boom",
      "[daisyclaw] Stack:",
      "[daisyclaw] Error: boom",
    ]);
    expect(lines.join("\n")).toContain("Error: boom");
  });
});
