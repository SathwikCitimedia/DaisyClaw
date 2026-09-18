/**
 * Resolves bundled static catalog rows for embedded-agent model selection.
 */
import type { NormalizedModelCatalogRow } from "@daisyclaw/model-catalog-core/model-catalog-types";
import { normalizeProviderId } from "@daisyclaw/model-catalog-core/provider-id";
import type { DaisyClawConfig } from "../../config/types.daisyclaw.js";
import { planManifestModelCatalogRows } from "../../model-catalog/manifest-planner.js";
import { listDaisyClawPluginManifestMetadata } from "../../plugins/manifest-metadata-scan.js";
import { loadPluginManifestRegistry } from "../../plugins/manifest-registry.js";
import type { PluginManifestRecord } from "../../plugins/manifest-registry.js";
import { loadPluginManifest } from "../../plugins/manifest.js";
import type { ProviderRuntimeModel } from "../../plugins/provider-runtime-model.types.js";
import { DEFAULT_CONTEXT_TOKENS } from "../defaults.js";
import { normalizeStaticProviderModelId } from "../model-ref-shared.js";

/**
 * Resolves bundled plugin static model-catalog rows into runtime model records.
 */
function rowMatchesModel(params: {
  row: NormalizedModelCatalogRow;
  provider: string;
  modelId: string;
}): boolean {
  const normalizedProvider = normalizeProviderId(params.provider);
  if (normalizeProviderId(params.row.provider) !== normalizedProvider) {
    return false;
  }
  return (
    normalizeStaticProviderModelId(normalizedProvider, params.row.id).trim().toLowerCase() ===
    normalizeStaticProviderModelId(normalizedProvider, params.modelId).trim().toLowerCase()
  );
}

function normalizeStaticCatalogInput(
  input: NormalizedModelCatalogRow["input"],
): ProviderRuntimeModel["input"] {
  const normalizedInput = input.filter(
    (item): item is "text" | "image" => item === "text" || item === "image",
  );
  return normalizedInput.length > 0 ? normalizedInput : ["text"];
}

function normalizeStaticCatalogCost(
  cost: NormalizedModelCatalogRow["cost"],
): ProviderRuntimeModel["cost"] {
  return {
    input: cost?.input ?? 0,
    output: cost?.output ?? 0,
    cacheRead: cost?.cacheRead ?? 0,
    cacheWrite: cost?.cacheWrite ?? 0,
  };
}

/** Converts a normalized catalog row into the provider runtime model shape. */
function modelFromStaticCatalogRow(row: NormalizedModelCatalogRow): ProviderRuntimeModel {
  return {
    id: row.id,
    name: row.name || row.id,
    provider: row.provider,
    api: row.api ?? "openai-responses",
    baseUrl: row.baseUrl ?? "",
    reasoning: row.reasoning,
    input: normalizeStaticCatalogInput(row.input),
    cost: normalizeStaticCatalogCost(row.cost),
    contextWindow: row.contextWindow ?? DEFAULT_CONTEXT_TOKENS,
    contextTokens: row.contextTokens,
    maxTokens: row.maxTokens ?? DEFAULT_CONTEXT_TOKENS,
    headers: row.headers,
    compat: row.compat,
    mediaInput: row.mediaInput,
  };
}

type StaticCatalogPlugin = Parameters<
  typeof planManifestModelCatalogRows
>[0]["registry"]["plugins"][number];

// Bundled manifests do not change while the process runs, and this lookup now
// sits on the path of every model resolution that nothing else could answer.
// Re-parsing ~120 manifests cost about 200 ms per miss. The metadata scan keeps
// its own fingerprint-checked cache and hands back the same record objects while
// nothing on disk changed, so comparing those objects by identity is enough to
// know whether the parsed list is still current.
let bundledStaticCatalogPluginsCache: {
  manifests: readonly unknown[];
  plugins: StaticCatalogPlugin[];
} | null = null;

function listBundledStaticCatalogPlugins(env: NodeJS.ProcessEnv): StaticCatalogPlugin[] {
  const records = listDaisyClawPluginManifestMetadata(env).filter(
    (record) => record.origin === "bundled",
  );
  const cached = bundledStaticCatalogPluginsCache;
  if (
    cached &&
    cached.manifests.length === records.length &&
    records.every((record, index) => record.manifest === cached.manifests[index])
  ) {
    return cached.plugins;
  }
  const plugins = records.flatMap((record): StaticCatalogPlugin[] => {
    const loaded = loadPluginManifest(record.pluginDir);
    if (!loaded.ok || !loaded.manifest.modelCatalog) {
      return [];
    }
    return [
      {
        id: loaded.manifest.id,
        providers: loaded.manifest.providers,
        modelCatalog: loaded.manifest.modelCatalog,
      },
    ];
  });
  bundledStaticCatalogPluginsCache = {
    manifests: records.map((record) => record.manifest),
    plugins,
  };
  return plugins;
}

/** Test seam: forget the cached bundled manifest list. */
export function resetBundledStaticCatalogPluginsCacheForTest(): void {
  bundledStaticCatalogPluginsCache = null;
}

function buildManifestModelCatalogProviderAliasTargets(
  plugins: readonly Pick<PluginManifestRecord, "providers" | "modelCatalog">[],
): Map<string, string> {
  const targetsByAlias = new Map<string, Set<string>>();
  for (const plugin of plugins) {
    for (const [rawAlias, alias] of Object.entries(plugin.modelCatalog?.aliases ?? {})) {
      const normalizedAlias = normalizeProviderId(rawAlias);
      const normalizedTarget = normalizeProviderId(alias.provider);
      if (
        !normalizedAlias ||
        !normalizedTarget ||
        !plugin.providers.some((providerId) => normalizeProviderId(providerId) === normalizedTarget)
      ) {
        continue;
      }
      const targets = targetsByAlias.get(normalizedAlias) ?? new Set<string>();
      targets.add(normalizedTarget);
      targetsByAlias.set(normalizedAlias, targets);
    }
  }
  const resolved = new Map<string, string>();
  for (const [alias, targets] of targetsByAlias) {
    // An alias two plugins disagree about is left alone, exactly as before.
    if (targets.size === 1) {
      resolved.set(alias, [...targets][0] as string);
    }
  }
  return resolved;
}

// Every model resolution starts by canonicalizing the provider, and this used to
// load the whole plugin manifest registry each time: a filesystem walk plus a
// parse of every manifest, measured at ~300 ms, two or three times per chat
// message. The answer only changes when plugins change, so it is held for a
// short window instead. The window is deliberately short so a plugin installed
// while the gateway runs is picked up within seconds without a restart.
const ALIAS_TARGETS_REVALIDATE_MS = 5_000;

let aliasTargetsCache: {
  checkedAt: number;
  cacheKey: string;
  targets: Map<string, string>;
} | null = null;

/** Test seam: forget the cached provider-alias map. */
export function resetManifestModelCatalogProviderAliasCacheForTest(): void {
  aliasTargetsCache = null;
}

function resolveAliasTargets(params: {
  cfg?: DaisyClawConfig;
  workspaceDir?: string;
  env: NodeJS.ProcessEnv;
  now: number;
}): Map<string, string> {
  const cacheKey = JSON.stringify([
    params.workspaceDir ?? "",
    params.cfg?.plugins ?? null,
    params.env.DAISYCLAW_STATE_DIR ?? "",
    params.env.DAISYCLAW_BUNDLED_PLUGINS_DIR ?? "",
    params.env.DAISYCLAW_DISABLE_BUNDLED_PLUGINS ?? "",
  ]);
  const cached = aliasTargetsCache;
  if (
    cached &&
    cached.cacheKey === cacheKey &&
    params.now - cached.checkedAt < ALIAS_TARGETS_REVALIDATE_MS
  ) {
    return cached.targets;
  }
  const targets = buildManifestModelCatalogProviderAliasTargets(
    loadPluginManifestRegistry({
      config: params.cfg,
      workspaceDir: params.workspaceDir,
      env: params.env,
    }).plugins,
  );
  aliasTargetsCache = { checkedAt: params.now, cacheKey, targets };
  return targets;
}

/** Resolves a provider alias from plugin model-catalog metadata when the alias is unambiguous. */
export function canonicalizeManifestModelCatalogProviderAlias(params: {
  provider: string;
  cfg?: DaisyClawConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
}): string {
  const provider = normalizeProviderId(params.provider);
  if (!provider) {
    return params.provider;
  }
  const targets = resolveAliasTargets({
    cfg: params.cfg,
    workspaceDir: params.workspaceDir,
    env: params.env ?? process.env,
    now: Date.now(),
  });
  return targets.get(provider) ?? params.provider;
}

/** Returns whether a bundled static catalog asks runtime discovery to augment its rows. */
export function bundledStaticCatalogProviderUsesRuntimeAugment(params: {
  provider: string;
  env?: NodeJS.ProcessEnv;
}): boolean {
  const provider = normalizeProviderId(params.provider);
  if (!provider) {
    return false;
  }
  return listBundledStaticCatalogPlugins(params.env ?? process.env).some((plugin) => {
    const catalog = plugin.modelCatalog;
    if (catalog?.runtimeAugment !== true) {
      return false;
    }
    return (
      Object.keys(catalog.providers ?? {}).some(
        (candidate) => normalizeProviderId(candidate) === provider,
      ) ||
      Object.keys(catalog.aliases ?? {}).some(
        (candidate) => normalizeProviderId(candidate) === provider,
      )
    );
  });
}

/** Resolves one bundled static-catalog model row for provider/model lookup. */
export function resolveBundledStaticCatalogModel(params: {
  provider: string;
  modelId: string;
  cfg?: DaisyClawConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  includeRuntimeDiscovery?: boolean;
}): ProviderRuntimeModel | undefined {
  const provider = normalizeProviderId(params.provider);
  if (!provider || !params.modelId.trim()) {
    return undefined;
  }
  const bundledStaticPlugins = listBundledStaticCatalogPlugins(params.env ?? process.env);
  if (bundledStaticPlugins.length === 0) {
    return undefined;
  }
  const plan = planManifestModelCatalogRows({
    registry: { plugins: bundledStaticPlugins },
    providerFilter: provider,
  });
  for (const entry of plan.entries) {
    if (
      entry.discovery !== "static" &&
      !(params.includeRuntimeDiscovery && entry.discovery === "runtime")
    ) {
      // Static lookups normally ignore runtime-discovery rows. Callers opt in only when they are
      // merging static catalog facts with already-discovered provider runtime state.
      continue;
    }
    const row = entry.rows.find((candidate) =>
      rowMatchesModel({
        row: candidate,
        provider,
        modelId: params.modelId,
      }),
    );
    if (row) {
      return modelFromStaticCatalogRow(row);
    }
  }
  return undefined;
}
