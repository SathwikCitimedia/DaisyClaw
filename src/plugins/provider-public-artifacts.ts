// Extracts provider public artifacts from plugin metadata.
import { normalizeProviderId } from "@daisyclaw/model-catalog-core/provider-id";
import type { DaisyClawConfig } from "../config/types.daisyclaw.js";
import type { ModelProviderConfig } from "../config/types.js";
import { resolveBundledPluginsDir } from "./bundled-dir.js";
import { loadPluginManifestRegistry, type PluginManifestRegistry } from "./manifest-registry.js";
import type {
  ProviderApplyConfigDefaultsContext,
  ProviderNormalizeConfigContext,
  ProviderResolveConfigApiKeyContext,
} from "./provider-config-context.types.js";
import type {
  ProviderDefaultThinkingPolicyContext,
  ProviderThinkingProfile,
} from "./provider-thinking.types.js";
import { loadBundledPluginPublicArtifactModuleSync } from "./public-surface-loader.js";

const PROVIDER_POLICY_ARTIFACT_CANDIDATES = ["provider-policy-api.js"] as const;
const providerPolicySurfaceByPluginId = new Map<string, BundledProviderPolicySurface | null>();

type BundledManifestPlugin = PluginManifestRegistry["plugins"][number];

// Bundled plugins ship with this build and cannot change while it runs, so the
// owner of each provider is looked up once per bundled directory. Without this,
// every provider check (config normalisation, API key resolution, thinking
// defaults) rediscovered and reopened every plugin manifest. One cold model
// catalog build spent about 30 of its 88 seconds doing that, with the event loop
// blocked, which pushed scheduled runs past their setup watchdog.
const bundledPolicyPluginsByDir = new Map<string, BundledManifestPlugin[]>();
const providerPolicyOwnerByKey = new Map<string, string | null>();

/**
 * The packaged bundled plugins change only when the app is updated, which
 * restarts it. A directory given through DAISYCLAW_BUNDLED_PLUGINS_DIR
 * (development, tests) can change under a running process, so it is read
 * fresh every time.
 */
function canCacheBundledPolicyOwners(): boolean {
  return !process.env.DAISYCLAW_BUNDLED_PLUGINS_DIR?.trim();
}

function listBundledPolicyPlugins(
  bundledPluginsDir: string,
  manifestRegistry: Pick<PluginManifestRegistry, "plugins"> | undefined,
): BundledManifestPlugin[] {
  const sortBundled = (plugins: readonly BundledManifestPlugin[]) =>
    plugins
      .filter((plugin) => plugin.origin === "bundled")
      .toSorted((left, right) => left.id.localeCompare(right.id));
  if (manifestRegistry) {
    return sortBundled(manifestRegistry.plugins);
  }
  if (!canCacheBundledPolicyOwners()) {
    return sortBundled(loadPluginManifestRegistry().plugins);
  }
  const cached = bundledPolicyPluginsByDir.get(bundledPluginsDir);
  if (cached) {
    return cached;
  }
  const plugins = sortBundled(loadPluginManifestRegistry().plugins);
  bundledPolicyPluginsByDir.set(bundledPluginsDir, plugins);
  return plugins;
}

/** Provider policy hooks loaded from bundled plugin public artifacts. */
export type BundledProviderPolicySurface = {
  normalizeConfig?: (ctx: ProviderNormalizeConfigContext) => ModelProviderConfig | null | undefined;
  applyConfigDefaults?: (
    ctx: ProviderApplyConfigDefaultsContext,
  ) => DaisyClawConfig | null | undefined;
  resolveConfigApiKey?: (ctx: ProviderResolveConfigApiKeyContext) => string | null | undefined;
  resolveThinkingProfile?: (
    ctx: ProviderDefaultThinkingPolicyContext,
  ) => ProviderThinkingProfile | null | undefined;
};

function hasProviderPolicyHook(
  mod: Record<string, unknown>,
): mod is Record<string, unknown> & BundledProviderPolicySurface {
  return (
    typeof mod.normalizeConfig === "function" ||
    typeof mod.applyConfigDefaults === "function" ||
    typeof mod.resolveConfigApiKey === "function" ||
    typeof mod.resolveThinkingProfile === "function"
  );
}

function tryLoadBundledProviderPolicySurface(
  pluginId: string,
): BundledProviderPolicySurface | null {
  const cacheKey = `${resolveBundledPluginsDir() ?? ""}\0${pluginId}`;
  const cached = providerPolicySurfaceByPluginId.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  for (const artifactBasename of PROVIDER_POLICY_ARTIFACT_CANDIDATES) {
    try {
      const mod = loadBundledPluginPublicArtifactModuleSync<Record<string, unknown>>({
        dirName: pluginId,
        artifactBasename,
      });
      if (hasProviderPolicyHook(mod)) {
        providerPolicySurfaceByPluginId.set(cacheKey, mod);
        return mod;
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Unable to resolve bundled plugin public surface ")
      ) {
        continue;
      }
      throw error;
    }
  }
  providerPolicySurfaceByPluginId.set(cacheKey, null);
  return null;
}

function resolveBundledProviderPolicyPluginId(
  providerId: string,
  options: { manifestRegistry?: Pick<PluginManifestRegistry, "plugins"> } = {},
): string | null {
  const normalizedProviderId = normalizeProviderId(providerId);
  if (!normalizedProviderId) {
    return null;
  }
  const bundledPluginsDir = resolveBundledPluginsDir();
  if (!bundledPluginsDir) {
    return null;
  }

  // An explicit registry is the caller's snapshot; only the default is cached.
  const ownerKey =
    options.manifestRegistry || !canCacheBundledPolicyOwners()
      ? undefined
      : `${bundledPluginsDir}\0${normalizedProviderId}`;
  if (ownerKey !== undefined && providerPolicyOwnerByKey.has(ownerKey)) {
    return providerPolicyOwnerByKey.get(ownerKey) ?? null;
  }
  let owner: string | null = null;
  for (const plugin of listBundledPolicyPlugins(bundledPluginsDir, options.manifestRegistry)) {
    if (pluginOwnsProviderPolicyRef(plugin, normalizedProviderId)) {
      owner = plugin.id;
      break;
    }
  }
  if (ownerKey !== undefined) {
    providerPolicyOwnerByKey.set(ownerKey, owner);
  }
  return owner;
}

function pluginOwnsProviderPolicyRef(
  plugin: PluginManifestRegistry["plugins"][number],
  normalizedProviderId: string,
): boolean {
  const ownedProviders = new Set(
    plugin.providers.map((provider) => normalizeProviderId(provider)).filter(Boolean),
  );
  if (ownedProviders.has(normalizedProviderId)) {
    return true;
  }

  for (const [rawAlias, rawTarget] of Object.entries(plugin.providerAuthAliases ?? {})) {
    const alias = normalizeProviderId(rawAlias);
    const target = normalizeProviderId(rawTarget);
    if (alias === normalizedProviderId && ownedProviders.has(target)) {
      return true;
    }
  }

  return false;
}

/** Resolves provider policy hooks for a bundled provider or its owning plugin. */
export function resolveBundledProviderPolicySurface(
  providerId: string,
  options: { manifestRegistry?: Pick<PluginManifestRegistry, "plugins"> } = {},
): BundledProviderPolicySurface | null {
  const normalizedProviderId = normalizeProviderId(providerId);
  if (!normalizedProviderId) {
    return null;
  }
  const directSurface = tryLoadBundledProviderPolicySurface(normalizedProviderId);
  if (directSurface) {
    return directSurface;
  }
  const ownerPluginId = resolveBundledProviderPolicyPluginId(normalizedProviderId, options);
  if (!ownerPluginId || ownerPluginId === normalizedProviderId) {
    return null;
  }
  return tryLoadBundledProviderPolicySurface(ownerPluginId);
}
