// Msteams plugin module implements runtime behavior.
import os from "node:os";
import path from "node:path";
import type { OpenKeyedStoreOptions } from "daisyclaw/plugin-sdk/plugin-state-runtime";
import { createPluginStateKeyedStoreForTests } from "daisyclaw/plugin-sdk/plugin-state-test-runtime";
import type { PluginRuntime } from "../../runtime-api.js";

export const msteamsRuntimeStub = {
  state: {
    openKeyedStore: (options: OpenKeyedStoreOptions) =>
      createPluginStateKeyedStoreForTests("msteams", options),
    resolveStateDir: (env: NodeJS.ProcessEnv = process.env, homedir?: () => string) => {
      const override = env.DAISYCLAW_STATE_DIR?.trim() || env.DAISYCLAW_STATE_DIR?.trim();
      if (override) {
        return override;
      }
      const resolvedHome = homedir ? homedir() : os.homedir();
      return path.join(resolvedHome, ".daisyclaw");
    },
  },
} as unknown as PluginRuntime;
