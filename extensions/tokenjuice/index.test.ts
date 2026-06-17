// Tokenjuice tests cover index plugin behavior.
import fs from "node:fs";
import { createTestPluginApi } from "daisyclaw/plugin-sdk/plugin-test-api";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { tokenjuiceFactory, createTokenjuiceDaisyClawEmbeddedExtension } = vi.hoisted(() => {
  const tokenjuiceFactoryLocal = vi.fn();
  const createTokenjuiceDaisyClawEmbeddedExtensionLocal = vi.fn(() => tokenjuiceFactoryLocal);
  return {
    tokenjuiceFactory: tokenjuiceFactoryLocal,
    createTokenjuiceDaisyClawEmbeddedExtension: createTokenjuiceDaisyClawEmbeddedExtensionLocal,
  };
});

vi.mock("./runtime-api.js", () => ({
  createTokenjuiceDaisyClawEmbeddedExtension,
}));

import plugin from "./index.js";

describe("tokenjuice plugin", () => {
  beforeEach(() => {
    createTokenjuiceDaisyClawEmbeddedExtension.mockClear();
    tokenjuiceFactory.mockClear();
  });

  it("is opt-in by default", () => {
    const manifest = JSON.parse(
      fs.readFileSync(new URL("./daisyclaw.plugin.json", import.meta.url), "utf8"),
    ) as { enabledByDefault?: unknown };

    expect(manifest.enabledByDefault).toBeUndefined();
  });

  it("registers tokenjuice tool result middleware for DaisyClaw and Codex runtimes", () => {
    const registerAgentToolResultMiddleware = vi.fn();

    plugin.register(
      createTestPluginApi({
        id: "tokenjuice",
        name: "tokenjuice",
        source: "test",
        config: {},
        pluginConfig: {},
        runtime: {} as never,
        registerAgentToolResultMiddleware,
      }),
    );

    expect(createTokenjuiceDaisyClawEmbeddedExtension).toHaveBeenCalledTimes(1);
    expect(tokenjuiceFactory).toHaveBeenCalledTimes(1);
    const registration = registerAgentToolResultMiddleware.mock.calls[0];
    expect(typeof registration?.[0]).toBe("function");
    expect(registration?.[1]).toEqual({ runtimes: ["daisyclaw", "codex"] });
  });
});
