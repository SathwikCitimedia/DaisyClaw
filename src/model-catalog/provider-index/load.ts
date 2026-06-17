// Provider-index loader normalizes bundled installable-provider metadata and falls back to an empty index.
import { normalizeDaisyClawProviderIndex } from "./normalize.js";
import { DAISYCLAW_PROVIDER_INDEX } from "./daisyclaw-provider-index.js";
import type { DaisyClawProviderIndex } from "./types.js";

// Load the bundled provider index through the normalizer. Invalid generated or
// caller-supplied data falls back to an empty v1 index instead of leaking shape.
export function loadDaisyClawProviderIndex(
  source: unknown = DAISYCLAW_PROVIDER_INDEX,
): DaisyClawProviderIndex {
  return normalizeDaisyClawProviderIndex(source) ?? { version: 1, providers: {} };
}
