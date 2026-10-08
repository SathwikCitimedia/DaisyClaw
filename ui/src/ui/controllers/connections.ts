// Control UI controller: connecting an account Daisy can work with.
//
// The values are stored the same way the Skills page stores a skill credential,
// under `skills.entries.<skillKey>.env`, so there is one mechanism rather than
// two. Connecting also switches the skill on: setup deliberately leaves these
// off, because a skill that is on but unconnected fails on first use.
// Disconnecting removes the values and switches it off again, for the same
// reason.
import type { GatewayBrowserClient } from "../gateway.ts";
import type { ConnectionDefinition, ConnectionDialogState } from "../views/connections.ts";

export type ConnectionsState = {
  client: GatewayBrowserClient | null;
  connected?: boolean;
  connectionDrafts: Record<string, string>;
  connectionBusyKey: string | null;
  connectionNotice: { skillKey: string; kind: "success" | "error"; message: string } | null;
  connectionDialog?: ConnectionDialogState | null;
};

type KeyCheck = { status: "valid" | "invalid" | "unreachable" | "unchecked"; message?: string };

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Asks the service whether the values work before they are saved. An engine
 * older than this check, or a service that cannot be asked right now, is not a
 * reason to refuse: the values are saved and the person is told it was not
 * checked.
 */
async function checkKeys(
  client: GatewayBrowserClient,
  skillKey: string,
  env: Record<string, string>,
): Promise<KeyCheck> {
  try {
    return (
      (await client.request<KeyCheck>("connections.checkKeys", { skillKey, env })) ?? {
        status: "unchecked",
      }
    );
  } catch (err) {
    if (/unknown method/i.test(errorMessage(err))) {
      return { status: "unchecked" };
    }
    throw err;
  }
}

/**
 * Checks and saves every value a service needs, then enables its skill.
 * Returns whether it worked, so the caller never reports a connection that did
 * not happen. On success the Connect card closes; on failure it stays open
 * with the reason, keeping what was typed.
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
    const check = await checkKeys(client, definition.skillKey, env);
    if (check.status === "invalid") {
      state.connectionNotice = {
        skillKey: definition.skillKey,
        kind: "error",
        message: check.message ?? `${definition.label} didn't accept that.`,
      };
      return false;
    }
    await client.request("skills.update", { skillKey: definition.skillKey, env });
    await client.request("skills.update", { skillKey: definition.skillKey, enabled: true });
    for (const field of definition.fields) {
      delete state.connectionDrafts[field.env];
    }
    if (state.connectionDialog?.skillKey === definition.skillKey) {
      state.connectionDialog = null;
    }
    state.connectionNotice = {
      skillKey: definition.skillKey,
      kind: "success",
      message:
        check.status === "unreachable"
          ? `${definition.label} connected, but ${definition.label} couldn't check the key just now. If Daisy has trouble using it, connect it again.`
          : `${definition.label} connected. You can ask Daisy about it now.`,
    };
    return true;
  } catch (err) {
    state.connectionNotice = {
      skillKey: definition.skillKey,
      kind: "error",
      message: `${definition.label} could not be connected: ${errorMessage(err)}`,
    };
    return false;
  } finally {
    state.connectionBusyKey = null;
  }
}

/**
 * Removes the saved values and switches the skill off. Returns whether it
 * worked; on failure the card stays open with the reason.
 */
export async function disconnectAccount(
  state: ConnectionsState,
  definition: ConnectionDefinition,
): Promise<boolean> {
  const client = state.client;
  if (!client || state.connected === false || definition.fields.length === 0) {
    return false;
  }
  state.connectionBusyKey = definition.skillKey;
  state.connectionNotice = null;
  try {
    await client.request("skills.update", {
      skillKey: definition.skillKey,
      // An empty value removes it; the key may also be saved as the skill's API key.
      env: Object.fromEntries(definition.fields.map((field) => [field.env, ""])),
      apiKey: "",
      enabled: false,
    });
    if (state.connectionDialog?.skillKey === definition.skillKey) {
      state.connectionDialog = null;
    }
    state.connectionNotice = {
      skillKey: definition.skillKey,
      kind: "success",
      message: `${definition.label} disconnected.`,
    };
    return true;
  } catch (err) {
    state.connectionNotice = {
      skillKey: definition.skillKey,
      kind: "error",
      message: `${definition.label} could not be disconnected: ${errorMessage(err)}`,
    };
    return false;
  } finally {
    state.connectionBusyKey = null;
  }
}
