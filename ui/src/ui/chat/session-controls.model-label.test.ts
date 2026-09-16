import { describe, expect, it } from "vitest";
import { resolveComposerModelLabel } from "./session-controls.ts";

describe("resolveComposerModelLabel", () => {
  // A fresh install carries the engine's built-in default model name. The chip
  // must not present it as a working setup while no provider has a key.
  it("asks for an AI brain while model setup is missing", () => {
    expect(
      resolveComposerModelLabel({ modelSetupMissing: true, selectedLabel: "openai/gpt-5.5" }),
    ).toBe("Add an AI brain");
  });

  it("shows the selected model once setup exists or is still unknown", () => {
    expect(
      resolveComposerModelLabel({ modelSetupMissing: false, selectedLabel: "openai/gpt-5.5" }),
    ).toBe("openai/gpt-5.5");
    expect(resolveComposerModelLabel({ modelSetupMissing: null, selectedLabel: "Default" })).toBe(
      "Default",
    );
  });
});
