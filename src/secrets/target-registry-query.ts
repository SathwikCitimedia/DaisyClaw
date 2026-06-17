/** Query helpers for discovering secret target registry entries. */
import type { DaisyClawConfig } from "../config/types.daisyclaw.js";
import { loadChannelSecretContractApi } from "./channel-contract-api.js";
import { getPath } from "./path-utils.js";
import { getCoreSecretTargetRegistry, getSecretTargetRegistry } from "./target-registry-data.js";
import {
  compileTargetRegistryEntry,
  expandPathTokens,
  materializePathTokens,
  matchPathTokens,
  type CompiledTargetRegistryEntry,
} from "./target-registry-pattern.js";
import type {
  DiscoveredConfigSecretTarget,
  ResolvedPlanTarget,
  SecretTargetRegistryEntry,
} from "./target-registry-types.js";

let compiledSecretTargetRegistryState: {
  authProfilesCompiledSecretTargets: CompiledTargetRegistryEntry[];
  authProfilesTargetsById: Map<string, CompiledTargetRegistryEntry[]>;
  compiledSecretTargetRegistry: CompiledTargetRegistryEntry[];
  knownTargetIds: Set<string>;
  daisyClawCompiledSecretTargets: CompiledTargetRegistryEntry[];
  daisyClawTargetsById: Map<string, CompiledTargetRegistryEntry[]>;
  targetsByType: Map<string, CompiledTargetRegistryEntry[]>;
} | null = null;

let compiledCoreDaisyClawTargetState: {
  knownTargetIds: Set<string>;
  daisyClawCompiledSecretTargets: CompiledTargetRegistryEntry[];
  daisyClawTargetsById: Map<string, CompiledTargetRegistryEntry[]>;
  targetsByType: Map<string, CompiledTargetRegistryEntry[]>;
} | null = null;

// Channel contract entries are process-stable; plugin install/reload is the owner of freshness.
const compiledChannelDaisyClawTargets = new Map<string, CompiledTargetRegistryEntry[] | null>();

function buildTargetTypeIndex(
  compiledSecretTargetRegistry: CompiledTargetRegistryEntry[],
): Map<string, CompiledTargetRegistryEntry[]> {
  const byType = new Map<string, CompiledTargetRegistryEntry[]>();
  const append = (type: string, entry: CompiledTargetRegistryEntry) => {
    const existing = byType.get(type);
    if (existing) {
      existing.push(entry);
      return;
    }
    byType.set(type, [entry]);
  };
  for (const entry of compiledSecretTargetRegistry) {
    append(entry.targetType, entry);
    for (const alias of entry.targetTypeAliases ?? []) {
      append(alias, entry);
    }
  }
  return byType;
}

function buildConfigTargetIdIndex(
  entries: CompiledTargetRegistryEntry[],
): Map<string, CompiledTargetRegistryEntry[]> {
  const byId = new Map<string, CompiledTargetRegistryEntry[]>();
  for (const entry of entries) {
    const existing = byId.get(entry.id);
    if (existing) {
      existing.push(entry);
      continue;
    }
    byId.set(entry.id, [entry]);
  }
  return byId;
}

function getCompiledSecretTargetRegistryState() {
  if (compiledSecretTargetRegistryState) {
    return compiledSecretTargetRegistryState;
  }
  const compiledSecretTargetRegistry = getSecretTargetRegistry().map(compileTargetRegistryEntry);
  const daisyClawCompiledSecretTargets = compiledSecretTargetRegistry.filter(
    (entry) => entry.configFile === "daisyclaw.json",
  );
  const authProfilesCompiledSecretTargets = compiledSecretTargetRegistry.filter(
    (entry) => entry.configFile === "auth-profiles.json",
  );
  compiledSecretTargetRegistryState = {
    authProfilesCompiledSecretTargets,
    authProfilesTargetsById: buildConfigTargetIdIndex(authProfilesCompiledSecretTargets),
    compiledSecretTargetRegistry,
    knownTargetIds: new Set(compiledSecretTargetRegistry.map((entry) => entry.id)),
    daisyClawCompiledSecretTargets,
    daisyClawTargetsById: buildConfigTargetIdIndex(daisyClawCompiledSecretTargets),
    targetsByType: buildTargetTypeIndex(compiledSecretTargetRegistry),
  };
  return compiledSecretTargetRegistryState;
}

function getCompiledCoreDaisyClawTargetState() {
  if (compiledCoreDaisyClawTargetState) {
    return compiledCoreDaisyClawTargetState;
  }
  const daisyClawCompiledSecretTargets = getCoreSecretTargetRegistry()
    .filter((entry) => entry.configFile === "daisyclaw.json")
    .map(compileTargetRegistryEntry);
  compiledCoreDaisyClawTargetState = {
    knownTargetIds: new Set(daisyClawCompiledSecretTargets.map((entry) => entry.id)),
    daisyClawCompiledSecretTargets,
    daisyClawTargetsById: buildConfigTargetIdIndex(daisyClawCompiledSecretTargets),
    targetsByType: buildTargetTypeIndex(daisyClawCompiledSecretTargets),
  };
  return compiledCoreDaisyClawTargetState;
}

function getCompiledChannelDaisyClawTargets(
  channelId: string,
): CompiledTargetRegistryEntry[] | null {
  const normalizedChannelId = channelId.trim();
  if (!normalizedChannelId) {
    return null;
  }
  if (compiledChannelDaisyClawTargets.has(normalizedChannelId)) {
    return compiledChannelDaisyClawTargets.get(normalizedChannelId) ?? null;
  }
  const compiledEntries =
    loadChannelSecretContractApi({
      channelId: normalizedChannelId,
      config: {} as DaisyClawConfig,
      env: process.env,
    })
      ?.secretTargetRegistryEntries?.filter((entry) => entry.configFile === "daisyclaw.json")
      .map(compileTargetRegistryEntry) ?? null;
  compiledChannelDaisyClawTargets.set(normalizedChannelId, compiledEntries);
  return compiledEntries;
}

function normalizeAllowedTargetIds(targetIds?: Iterable<string>): Set<string> | null {
  if (targetIds === undefined) {
    return null;
  }
  return new Set(
    Array.from(targetIds)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );
}

function resolveDiscoveryEntries(params: {
  allowedTargetIds: Set<string> | null;
  defaultEntries: CompiledTargetRegistryEntry[];
  entriesById: Map<string, CompiledTargetRegistryEntry[]>;
}): CompiledTargetRegistryEntry[] {
  if (params.allowedTargetIds === null) {
    return params.defaultEntries;
  }
  return Array.from(params.allowedTargetIds).flatMap(
    (targetId) => params.entriesById.get(targetId) ?? [],
  );
}

function discoverSecretTargetsFromEntries(
  source: unknown,
  discoveryEntries: CompiledTargetRegistryEntry[],
): DiscoveredConfigSecretTarget[] {
  const out: DiscoveredConfigSecretTarget[] = [];
  const seen = new Set<string>();

  for (const entry of discoveryEntries) {
    const expanded = expandPathTokens(source, entry.pathTokens);
    for (const match of expanded) {
      const resolved = toResolvedPlanTarget(entry, match.segments, match.captures);
      if (!resolved) {
        continue;
      }
      const key = `${entry.id}:${resolved.pathSegments.join(".")}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      const refValue = resolved.refPathSegments
        ? getPath(source, resolved.refPathSegments)
        : undefined;
      out.push({
        entry,
        path: resolved.pathSegments.join("."),
        pathSegments: resolved.pathSegments,
        ...(resolved.refPathSegments
          ? {
              refPathSegments: resolved.refPathSegments,
              refPath: resolved.refPathSegments.join("."),
            }
          : {}),
        value: match.value,
        ...(resolved.providerId ? { providerId: resolved.providerId } : {}),
        ...(resolved.accountId ? { accountId: resolved.accountId } : {}),
        ...(resolved.refPathSegments ? { refValue } : {}),
      });
    }
  }

  return out;
}

function toResolvedPlanTarget(
  entry: CompiledTargetRegistryEntry,
  pathSegments: string[],
  captures: string[],
): ResolvedPlanTarget | null {
  const providerId =
    entry.providerIdPathSegmentIndex !== undefined
      ? pathSegments[entry.providerIdPathSegmentIndex]
      : undefined;
  const accountId =
    entry.accountIdPathSegmentIndex !== undefined
      ? pathSegments[entry.accountIdPathSegmentIndex]
      : undefined;
  const refPathSegments = entry.refPathTokens
    ? materializePathTokens(entry.refPathTokens, captures)
    : undefined;
  if (entry.refPathTokens && !refPathSegments) {
    return null;
  }
  return {
    entry,
    pathSegments,
    ...(refPathSegments ? { refPathSegments } : {}),
    ...(providerId ? { providerId } : {}),
    ...(accountId ? { accountId } : {}),
  };
}

/**
 * Lists the full secrets target registry in public, serializable form.
 */
/** Lists all configured secret target registry entries. */
export function listSecretTargetRegistryEntries(): SecretTargetRegistryEntry[] {
  return getCompiledSecretTargetRegistryState().compiledSecretTargetRegistry.map((entry) =>
    Object.assign(
      { id: entry.id, targetType: entry.targetType },
      entry.targetTypeAliases ? { targetTypeAliases: [...entry.targetTypeAliases] } : {},
      { configFile: entry.configFile, pathPattern: entry.pathPattern },
      entry.refPathPattern ? { refPathPattern: entry.refPathPattern } : {},
      {
        secretShape: entry.secretShape,
        expectedResolvedValue: entry.expectedResolvedValue,
        includeInPlan: entry.includeInPlan,
        includeInConfigure: entry.includeInConfigure,
        includeInAudit: entry.includeInAudit,
      },
      entry.providerIdPathSegmentIndex !== undefined
        ? { providerIdPathSegmentIndex: entry.providerIdPathSegmentIndex }
        : {},
      entry.accountIdPathSegmentIndex !== undefined
        ? { accountIdPathSegmentIndex: entry.accountIdPathSegmentIndex }
        : {},
      entry.authProfileType ? { authProfileType: entry.authProfileType } : {},
      entry.trackProviderShadowing ? { trackProviderShadowing: true } : {},
    ),
  );
}

/**
 * Narrows unknown input to a target id currently present in the compiled registry.
 */
export function isKnownSecretTargetId(value: unknown): value is string {
  return (
    typeof value === "string" && getCompiledSecretTargetRegistryState().knownTargetIds.has(value)
  );
}

/**
 * Resolves a secrets apply-plan target against registered target type and path patterns.
 */
export function resolvePlanTargetAgainstRegistry(candidate: {
  type: string;
  pathSegments: string[];
  providerId?: string;
  accountId?: string;
}): ResolvedPlanTarget | null {
  const coreEntries = getCompiledCoreDaisyClawTargetState().targetsByType.get(candidate.type);
  if (coreEntries) {
    return resolvePlanTargetAgainstEntries(candidate, coreEntries);
  }
  const entries = getCompiledSecretTargetRegistryState().targetsByType.get(candidate.type);
  return resolvePlanTargetAgainstEntries(candidate, entries);
}

function resolvePlanTargetAgainstEntries(
  candidate: {
    type: string;
    pathSegments: string[];
    providerId?: string;
    accountId?: string;
  },
  entries: CompiledTargetRegistryEntry[] | undefined,
): ResolvedPlanTarget | null {
  if (!entries || entries.length === 0) {
    return null;
  }

  for (const entry of entries) {
    if (!entry.includeInPlan) {
      continue;
    }
    const matched = matchPathTokens(candidate.pathSegments, entry.pathTokens);
    if (!matched) {
      continue;
    }
    const resolved = toResolvedPlanTarget(entry, candidate.pathSegments, matched.captures);
    if (!resolved) {
      continue;
    }
    if (candidate.providerId && candidate.providerId.trim().length > 0) {
      if (!resolved.providerId || resolved.providerId !== candidate.providerId) {
        continue;
      }
    }
    if (candidate.accountId && candidate.accountId.trim().length > 0) {
      if (!resolved.accountId || resolved.accountId !== candidate.accountId) {
        continue;
      }
    }
    return resolved;
  }
  return null;
}

/**
 * Resolves an daisyclaw.json config path to the matching plan-capable secrets target.
 */
export function resolveConfigSecretTargetByPath(pathSegments: string[]): ResolvedPlanTarget | null {
  for (const entry of getCompiledCoreDaisyClawTargetState().daisyClawCompiledSecretTargets) {
    if (!entry.includeInPlan) {
      continue;
    }
    const matched = matchPathTokens(pathSegments, entry.pathTokens);
    if (!matched) {
      continue;
    }
    const resolved = toResolvedPlanTarget(entry, pathSegments, matched.captures);
    if (!resolved) {
      continue;
    }
    return resolved;
  }

  const explicitChannelId = pathSegments[0] === "channels" ? (pathSegments[1]?.trim() ?? "") : "";
  const explicitChannelEntries = explicitChannelId
    ? getCompiledChannelDaisyClawTargets(explicitChannelId)
    : null;
  // Channel-owned contracts get first chance for explicit channel paths before bundled defaults.
  for (const entry of explicitChannelEntries ?? []) {
    if (!entry.includeInPlan) {
      continue;
    }
    const matched = matchPathTokens(pathSegments, entry.pathTokens);
    if (!matched) {
      continue;
    }
    const resolved = toResolvedPlanTarget(entry, pathSegments, matched.captures);
    if (!resolved) {
      continue;
    }
    return resolved;
  }

  for (const entry of getCompiledSecretTargetRegistryState().daisyClawCompiledSecretTargets) {
    if (!entry.includeInPlan) {
      continue;
    }
    const matched = matchPathTokens(pathSegments, entry.pathTokens);
    if (!matched) {
      continue;
    }
    const resolved = toResolvedPlanTarget(entry, pathSegments, matched.captures);
    if (!resolved) {
      continue;
    }
    return resolved;
  }
  return null;
}

/**
 * Discovers configured secret-bearing values in daisyclaw.json using the full registry.
 */
export function discoverConfigSecretTargets(
  config: DaisyClawConfig,
): DiscoveredConfigSecretTarget[] {
  return discoverConfigSecretTargetsByIds(config);
}

/**
 * Discovers configured daisyclaw.json targets, optionally limited to selected registry ids.
 */
export function discoverConfigSecretTargetsByIds(
  config: DaisyClawConfig,
  targetIds?: Iterable<string>,
): DiscoveredConfigSecretTarget[] {
  const allowedTargetIds = normalizeAllowedTargetIds(targetIds);
  const registryState =
    allowedTargetIds !== null &&
    Array.from(allowedTargetIds).every((targetId) =>
      getCompiledCoreDaisyClawTargetState().knownTargetIds.has(targetId),
    )
      ? getCompiledCoreDaisyClawTargetState()
      : getCompiledSecretTargetRegistryState();
  const discoveryEntries = resolveDiscoveryEntries({
    allowedTargetIds,
    defaultEntries: registryState.daisyClawCompiledSecretTargets,
    entriesById: registryState.daisyClawTargetsById,
  });
  return discoverSecretTargetsFromEntries(config, discoveryEntries);
}

/**
 * Discovers secret-bearing values in auth-profiles.json store objects.
 */
export function discoverAuthProfileSecretTargets(
  store: unknown,
  targetIds?: Iterable<string>,
): DiscoveredConfigSecretTarget[] {
  const allowedTargetIds = normalizeAllowedTargetIds(targetIds);
  const registryState = getCompiledSecretTargetRegistryState();
  const discoveryEntries = resolveDiscoveryEntries({
    allowedTargetIds,
    defaultEntries: registryState.authProfilesCompiledSecretTargets,
    entriesById: registryState.authProfilesTargetsById,
  });
  return discoverSecretTargetsFromEntries(store, discoveryEntries);
}

/**
 * Lists auth-profile target entries that participate in plaintext/unresolved-ref audit.
 */
export function listAuthProfileSecretTargetEntries(): SecretTargetRegistryEntry[] {
  return getCompiledSecretTargetRegistryState().compiledSecretTargetRegistry.filter(
    (entry) => entry.configFile === "auth-profiles.json" && entry.includeInAudit,
  );
}

export type {
  AuthProfileType,
  DiscoveredConfigSecretTarget,
  ResolvedPlanTarget,
  SecretTargetConfigFile,
  SecretTargetExpected,
  SecretTargetRegistryEntry,
  SecretTargetShape,
} from "./target-registry-types.js";
