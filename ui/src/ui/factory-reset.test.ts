/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearFactoryResetPending,
  clearLocalStateForFactoryReset,
  FACTORY_RESET_PENDING_KEY,
  FACTORY_RESET_PENDING_TTL_MS,
  isFactoryResetPending,
  markFactoryResetPending,
  readFactoryResetPendingAt,
} from "./factory-reset.ts";

function createStorageMock(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

beforeEach(() => {
  vi.stubGlobal("localStorage", createStorageMock());
});

describe("factory reset pending marker", () => {
  it("round-trips and expires after the TTL", () => {
    expect(isFactoryResetPending()).toBe(false);
    markFactoryResetPending(1_000);
    expect(readFactoryResetPendingAt()).toBe(1_000);
    expect(isFactoryResetPending(2_000)).toBe(true);
    expect(isFactoryResetPending(1_000 + FACTORY_RESET_PENDING_TTL_MS + 1)).toBe(false);
    // Expiry clears the marker so the dashboard stops showing the card.
    expect(localStorage.getItem(FACTORY_RESET_PENDING_KEY)).toBeNull();
  });

  it("clears on demand", () => {
    markFactoryResetPending();
    clearFactoryResetPending();
    expect(isFactoryResetPending()).toBe(false);
  });
});

describe("clearLocalStateForFactoryReset", () => {
  it("drops old-install records but keeps the connection settings and token", () => {
    localStorage.setItem(
      "daisyclaw.control.settings.v1:ws://127.0.0.1:18789",
      '{"gatewayUrl":"x"}',
    );
    localStorage.setItem("daisyclaw.control.token.v1:ws://127.0.0.1:18789", "tok");
    localStorage.setItem("daisyclaw.control.firstRunDone.v1", "done");
    localStorage.setItem("daisyclaw.control.user.v1", '{"name":"Sam"}');
    localStorage.setItem("daisyclaw.control.chatDraft.v1", "hello");
    localStorage.setItem("unrelated.app.key", "keep");
    markFactoryResetPending();

    clearLocalStateForFactoryReset();

    expect(localStorage.getItem("daisyclaw.control.settings.v1:ws://127.0.0.1:18789")).toBe(
      '{"gatewayUrl":"x"}',
    );
    expect(localStorage.getItem("daisyclaw.control.token.v1:ws://127.0.0.1:18789")).toBe("tok");
    expect(localStorage.getItem("unrelated.app.key")).toBe("keep");
    expect(isFactoryResetPending()).toBe(true);
    expect(localStorage.getItem("daisyclaw.control.firstRunDone.v1")).toBeNull();
    expect(localStorage.getItem("daisyclaw.control.user.v1")).toBeNull();
    expect(localStorage.getItem("daisyclaw.control.chatDraft.v1")).toBeNull();
  });
});
