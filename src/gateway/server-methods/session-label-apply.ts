// Persists an auto-generated session label using the same store pipeline as the
// sessions.patch RPC, then broadcasts sessions.changed so connected UIs update.
// Kept in its own module so chat.send can apply auto-titles without importing
// the sessions handler module (which would create an import cycle).
import { updateSessionStore } from "../../config/sessions.js";
import type { DaisyClawConfig } from "../../config/types.daisyclaw.js";
import {
  migrateAndPruneGatewaySessionStoreKey,
  resolveGatewaySessionStoreTarget,
} from "../session-utils.js";
import { applySessionsPatchToStore } from "../sessions-patch.js";
import { emitSessionsChanged } from "./session-change-event.js";

type EmitSessionsChangedContext = Parameters<typeof emitSessionsChanged>[0];

/**
 * Best-effort: returns false (never throws) when the label cannot be applied
 * (store unavailable, label already in use, etc.).
 */
export async function applyAutoSessionLabel(params: {
  context: EmitSessionsChangedContext;
  cfg: DaisyClawConfig;
  key: string;
  agentId?: string;
  label: string;
}): Promise<boolean> {
  const { context, cfg, key, agentId, label } = params;
  try {
    const target = resolveGatewaySessionStoreTarget({
      cfg,
      key,
      ...(agentId ? { agentId } : {}),
    });
    const applied = await updateSessionStore(target.storePath, async (store) => {
      const { primaryKey } = migrateAndPruneGatewaySessionStoreKey({
        cfg,
        key,
        store,
        ...(agentId ? { agentId } : {}),
      });
      return await applySessionsPatchToStore({
        cfg,
        store,
        storeKey: primaryKey,
        ...(agentId ? { agentId } : {}),
        patch: { key, label } as unknown as Parameters<
          typeof applySessionsPatchToStore
        >[0]["patch"],
      });
    });
    if (!applied.ok) {
      return false;
    }
    emitSessionsChanged(context, {
      sessionKey: target.canonicalKey,
      ...(target.canonicalKey === "global" && agentId ? { agentId } : {}),
      reason: "patch",
    });
    return true;
  } catch {
    return false;
  }
}
