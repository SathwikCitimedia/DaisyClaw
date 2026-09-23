import { describe, expect, it, vi } from "vitest";
import { connectAccount, type ConnectionsState } from "../controllers/connections.ts";
import type { SkillStatusEntry } from "../types.ts";
import { CONNECTIONS, resolveConnectionStatus } from "./connections.ts";

function skill(skillKey: string, missingEnv: string[] = []): SkillStatusEntry {
  return { skillKey, missing: { env: missingEnv, bins: [] } } as unknown as SkillStatusEntry;
}

function definition(skillKey: string) {
  const found = CONNECTIONS.find((entry) => entry.skillKey === skillKey);
  if (!found) {
    throw new Error(`no connection defined for ${skillKey}`);
  }
  return found;
}

describe("account connections", () => {
  // Setup switched these four on and then offered nowhere to connect them, so
  // the user's first real request failed and looked like a broken assistant.
  it("covers every account skill the setup wizard offers", () => {
    expect(CONNECTIONS.map((entry) => entry.skillKey).toSorted()).toEqual([
      "gog",
      "notion",
      "spotify-player",
      "trello",
    ]);
  });

  it("says a service is not connected while its value is missing", () => {
    expect(
      resolveConnectionStatus(definition("notion"), skill("notion", ["NOTION_API_TOKEN"])),
    ).toBe("not-connected");
  });

  it("says connected once nothing is missing", () => {
    expect(resolveConnectionStatus(definition("notion"), skill("notion"))).toBe("connected");
  });

  it("needs both Trello values before it counts as connected", () => {
    expect(resolveConnectionStatus(definition("trello"), skill("trello", ["TRELLO_TOKEN"]))).toBe(
      "not-connected",
    );
  });

  it("admits Google and Spotify cannot be connected yet rather than offering a dead box", () => {
    for (const key of ["gog", "spotify-player"]) {
      expect(resolveConnectionStatus(definition(key), skill(key))).toBe("unavailable");
      expect(definition(key).unavailableNote).toBeTruthy();
      expect(definition(key).fields).toHaveLength(0);
    }
  });
});

describe("connecting an account", () => {
  function makeState(request: ReturnType<typeof vi.fn>): ConnectionsState {
    return {
      client: { request } as never,
      connected: true,
      connectionDrafts: {},
      connectionBusyKey: null,
      connectionNotice: null,
    };
  }

  it("saves the value and switches the skill on", async () => {
    const request = vi.fn(async () => ({ ok: true }));
    const state = makeState(request);
    state.connectionDrafts.NOTION_API_TOKEN = "ntn_secret";

    const ok = await connectAccount(state, definition("notion"));

    expect(ok).toBe(true);
    expect(request).toHaveBeenCalledWith("skills.update", {
      skillKey: "notion",
      env: { NOTION_API_TOKEN: "ntn_secret" },
    });
    expect(request).toHaveBeenCalledWith("skills.update", { skillKey: "notion", enabled: true });
    // The typed secret does not linger in view state.
    expect(state.connectionDrafts.NOTION_API_TOKEN).toBeUndefined();
    expect(state.connectionNotice?.kind).toBe("success");
  });

  it("refuses when a required value is blank", async () => {
    const request = vi.fn(async () => ({ ok: true }));
    const state = makeState(request);
    state.connectionDrafts.TRELLO_API_KEY = "key";

    const ok = await connectAccount(state, definition("trello"));

    expect(ok).toBe(false);
    expect(request).not.toHaveBeenCalled();
    expect(state.connectionNotice?.kind).toBe("error");
  });

  it("reports a failure instead of claiming it connected", async () => {
    const request = vi.fn(async () => {
      throw new Error("token rejected");
    });
    const state = makeState(request);
    state.connectionDrafts.NOTION_API_TOKEN = "bad";

    const ok = await connectAccount(state, definition("notion"));

    expect(ok).toBe(false);
    expect(state.connectionNotice?.kind).toBe("error");
    expect(state.connectionBusyKey).toBeNull();
  });
});
