/** Resolves configured channel conversation bindings into ACP session binding specs. */
import {
  resolveConfiguredBindingRecord,
  resolveConfiguredBindingRecordBySessionKey,
} from "../channels/plugins/binding-registry.js";
import type { DaisyClawConfig } from "../config/types.daisyclaw.js";
import {
  resolveConfiguredAcpBindingSpecFromRecord,
  toResolvedConfiguredAcpBinding,
  type ConfiguredAcpBindingSpec,
  type ResolvedConfiguredAcpBinding,
} from "./persistent-bindings.types.js";

/** Resolves a configured ACP binding for a concrete channel conversation. */
export function resolveConfiguredAcpBindingRecord(params: {
  cfg: DaisyClawConfig;
  channel: string;
  accountId: string;
  conversationId: string;
  parentConversationId?: string;
}): ResolvedConfiguredAcpBinding | null {
  const resolved = resolveConfiguredBindingRecord(params);
  return resolved ? toResolvedConfiguredAcpBinding(resolved.record) : null;
}

/** Resolves the configured ACP binding spec that owns a generated session key. */
export function resolveConfiguredAcpBindingSpecBySessionKey(params: {
  cfg: DaisyClawConfig;
  sessionKey: string;
}): ConfiguredAcpBindingSpec | null {
  const resolved = resolveConfiguredBindingRecordBySessionKey(params);
  return resolved ? resolveConfiguredAcpBindingSpecFromRecord(resolved.record) : null;
}
