// Verifies bundled capability runtime registration from plugin metadata.
import { describe, expect, it } from "vitest";
import { buildVitestCapabilityShimAliasMap } from "./bundled-capability-runtime.js";

describe("buildVitestCapabilityShimAliasMap", () => {
  it("keeps scoped and unscoped capability shim aliases aligned", () => {
    const aliasMap = buildVitestCapabilityShimAliasMap();

    expect(aliasMap["daisyclaw/plugin-sdk/config-runtime"]).toBe(
      aliasMap["@daisyclaw/plugin-sdk/config-runtime"],
    );
    expect(aliasMap["daisyclaw/plugin-sdk/media-runtime"]).toBe(
      aliasMap["@daisyclaw/plugin-sdk/media-runtime"],
    );
    expect(aliasMap["daisyclaw/plugin-sdk/provider-onboard"]).toBe(
      aliasMap["@daisyclaw/plugin-sdk/provider-onboard"],
    );
    expect(aliasMap["daisyclaw/plugin-sdk/speech-core"]).toBe(
      aliasMap["@daisyclaw/plugin-sdk/speech-core"],
    );
  });
});
