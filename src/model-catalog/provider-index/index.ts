// Provider-index public facade for normalized provider discovery metadata.
export { loadDaisyClawProviderIndex } from "./load.js";
export { normalizeDaisyClawProviderIndex } from "./normalize.js";
export type {
  DaisyClawProviderIndex,
  DaisyClawProviderIndexPluginInstall,
  DaisyClawProviderIndexPlugin,
  DaisyClawProviderIndexProviderAuthChoice,
  DaisyClawProviderIndexProvider,
} from "./types.js";
