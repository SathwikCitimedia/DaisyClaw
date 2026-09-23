// Control UI controller: connecting an account Daisy can work with.
//
// The values are stored the same way the Skills page stores a skill credential,
// under `skills.entries.<skillKey>.env`, so there is one mechanism rather than
// two. Connecting also switches the skill on: setup deliberately leaves these
// off, because a skill that is on but unconnected fails on first use.
import type { GatewayBrowserClient } from "../gateway.ts";
import type { ConnectionDefinition } from "../views/connections.ts";

export type ConnectionsState = {
  client: GatewayBrowserClient | null;
  connected?: boolean;
  connectionDrafts: Record<string, string>;
  connectionBusyKey: string | null;
  connectionNotice: { skillKey: string; kind: "success" | "error"; message: string } | null;
};

/**
 * Saves every value a service needs, then enables its skill. Returns whether it
 * worked, so the caller never reports a connection that did not happen.
 */
export async function connectAccount(
  state: ConnectionsState,
  definition: ConnectionDefinition,
): Promise<boolean> {
  const client = state.client;
  if (!client || state.connected === false || definition.fields.length === 0) {
    return false;
  }
  const env: Record<string, string> = {};
  for (const field of definition.fields) {
    const value = (state.connectionDrafts[field.env] ?? "").trim();
    if (!value) {
      state.connectionNotice = {
        skillKey: definition.skillKey,
        kind: "error",
        message: `${field.label} is still empty.`,
      };
      return false;
    }
    env[field.env] = value;
  }

  state.connectionBusyKey = definition.skillKey;
  state.connectionNotice = null;
  try {
    await client.request("skills.update", { skillKey: definition.skillKey, env });
    await client.request("skills.update", { skillKey: definition.skillKey, enabled: true });
    for (const field of definition.fields) {
      delete state.connectionDrafts[field.env];
    }
    state.connectionNotice = {
      skillKey: definition.skillKey,
      kind: "success",
      message: `${definition.label} connected. You can ask Daisy about it now.`,
    };
    return true;
  } catch (err) {
    state.connectionNotice = {
      skillKey: definition.skillKey,
      kind: "error",
      message: `${definition.label} could not be connected: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
    return false;
  } finally {
    state.connectionBusyKey = null;
  }
}
