import { describe, expect, it } from "vitest";
import { shouldPreloadBundledChannelPlugins } from "./channel-plugin-preload.js";

describe("shouldPreloadBundledChannelPlugins", () => {
  it("is off by default outside consumer builds", () => {
    expect(shouldPreloadBundledChannelPlugins({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it("follows the explicit override in both directions", () => {
    expect(
      shouldPreloadBundledChannelPlugins({
        DAISYCLAW_PRELOAD_CHANNEL_PLUGINS: "1",
      } as NodeJS.ProcessEnv),
    ).toBe(true);
    expect(
      shouldPreloadBundledChannelPlugins({
        DAISYCLAW_PRELOAD_CHANNEL_PLUGINS: "true",
      } as NodeJS.ProcessEnv),
    ).toBe(true);
    expect(
      shouldPreloadBundledChannelPlugins({
        DAISYCLAW_PRELOAD_CHANNEL_PLUGINS: "0",
        DAISYCLAW_CONSUMER_LOCKDOWN: "1",
      } as NodeJS.ProcessEnv),
    ).toBe(false);
  });

  it("is on in a consumer build", () => {
    expect(
      shouldPreloadBundledChannelPlugins({
        DAISYCLAW_CONSUMER_LOCKDOWN: "1",
      } as NodeJS.ProcessEnv),
    ).toBe(true);
  });
});
