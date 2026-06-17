// Config-runtime Vitest shims expose lightweight config helpers for capability runtime tests.
import { resolveActiveTalkProviderConfig } from "../../config/talk.js";
import type { DaisyClawConfig } from "../../config/types.js";

/** Vitest shim re-export for config runtime compatibility in capability tests. */
export { resolveActiveTalkProviderConfig };

/** Capability-test shim snapshot; tests inject config through direct helpers instead. */
export function getRuntimeConfigSnapshot(): DaisyClawConfig | null {
  return null;
}
