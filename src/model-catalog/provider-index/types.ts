// Provider-index types describe install hints, auth choices, and preview catalogs for discoverable providers.
import type { ModelCatalogProvider } from "@daisyclaw/model-catalog-core/model-catalog-types";

// Normalized provider-index schema. It describes providers discoverable before
// plugin install, including install hints, auth choices, and preview catalogs.
export type DaisyClawProviderIndexPluginInstall = {
  clawhubSpec?: string;
  npmSpec?: string;
  defaultChoice?: "clawhub" | "npm";
  minHostVersion?: string;
  expectedIntegrity?: string;
};

export type DaisyClawProviderIndexPlugin = {
  id: string;
  package?: string;
  source?: string;
  install?: DaisyClawProviderIndexPluginInstall;
};

export type DaisyClawProviderIndexProviderAuthChoice = {
  method: string;
  choiceId: string;
  choiceLabel: string;
  choiceHint?: string;
  assistantPriority?: number;
  assistantVisibility?: "visible" | "manual-only";
  groupId?: string;
  groupLabel?: string;
  groupHint?: string;
  optionKey?: string;
  cliFlag?: string;
  cliOption?: string;
  cliDescription?: string;
  onboardingScopes?: readonly ("text-inference" | "image-generation" | "music-generation")[];
};

export type DaisyClawProviderIndexProvider = {
  id: string;
  name: string;
  plugin: DaisyClawProviderIndexPlugin;
  docs?: string;
  categories?: readonly string[];
  authChoices?: readonly DaisyClawProviderIndexProviderAuthChoice[];
  previewCatalog?: ModelCatalogProvider;
};

export type DaisyClawProviderIndex = {
  version: number;
  providers: Readonly<Record<string, DaisyClawProviderIndexProvider>>;
};
