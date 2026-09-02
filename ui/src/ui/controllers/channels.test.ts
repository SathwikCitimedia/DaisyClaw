// Control UI tests cover channels behavior.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChannelsStatusSnapshot } from "../types.ts";
import {
  addAllowedContact,
  addAllowedContacts,
  connectWhatsApp,
  loadChannels,
  removeAllowedContact,
  renameAllowedContact,
  type ChannelsState,
} from "./channels.ts";

function createDeferred<T>() {
  let resolve: ((value: T) => void) | undefined;
  let reject: ((reason?: unknown) => void) | undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  if (!resolve || !reject) {
    throw new Error("Expected deferred callbacks to be initialized");
  }
  return { promise, resolve, reject };
}

function createChannelsSnapshot(label: string): ChannelsStatusSnapshot {
  return {
    ts: Date.now(),
    channelOrder: ["test"],
    channelLabels: { test: label },
    channels: {},
    channelAccounts: {},
    channelDefaultAccountId: {},
  };
}

function createState(): ChannelsState {
  return {
    client: {
      request: vi.fn(),
    } as never,
    connected: true,
    channelsLoading: false,
    channelsSnapshot: null,
    channelsError: null,
    channelsLastSuccess: null,
    whatsappLoginMessage: null,
    whatsappLoginQrDataUrl: "data:image/png;base64,current-qr",
    whatsappLoginConnected: false,
    whatsappBusy: false,
  };
}

function requireClientRequest(state: ChannelsState) {
  const request = state.client?.["request"];
  if (!request) {
    throw new Error("Expected channels controller client request");
  }
  return vi.mocked(request);
}

describe("channels controller WhatsApp connect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-enables the channel, shows the QR, follows rotation, and polls until scanned", async () => {
    const state = createState();
    const request = requireClientRequest(state);
    let waitCalls = 0;
    request.mockImplementation(async (method: string) => {
      switch (method) {
        case "config.get":
          return {
            hash: "hash-1",
            config: { channels: { whatsapp: { enabled: false } } },
          };
        case "config.patch":
          return {};
        case "channels.start":
          return {};
        case "web.login.start":
          return { qrDataUrl: "data:image/png;base64,first-qr" };
        case "web.login.wait":
          waitCalls += 1;
          if (waitCalls === 1) {
            return { connected: false, qrDataUrl: "data:image/png;base64,next-qr" };
          }
          return { connected: true, message: "WhatsApp connected." };
        default:
          throw new Error(`unexpected method: ${method}`);
      }
    });

    await connectWhatsApp(state, false);

    expect(request).toHaveBeenCalledWith("config.patch", {
      raw: JSON.stringify({ channels: { whatsapp: { enabled: true } } }),
      baseHash: "hash-1",
    });
    expect(request).toHaveBeenCalledWith("channels.start", { channel: "whatsapp" });
    expect(request).toHaveBeenCalledWith(
      "web.login.wait",
      {
        timeoutMs: 30000,
        currentQrDataUrl: "data:image/png;base64,first-qr",
      },
      { timeoutMs: 45_000 },
    );
    expect(request).toHaveBeenCalledWith(
      "web.login.wait",
      {
        timeoutMs: 30000,
        currentQrDataUrl: "data:image/png;base64,next-qr",
      },
      { timeoutMs: 45_000 },
    );
    expect(state.whatsappLoginConnected).toBe(true);
    expect(state.whatsappLoginQrDataUrl).toBeNull();
    expect(state.whatsappLoginMessage).toBe("WhatsApp connected.");
    expect(state.whatsappBusy).toBe(false);
  });

  it("reports already-linked without polling when login start says connected", async () => {
    const state = createState();
    const request = requireClientRequest(state);
    request.mockImplementation(async (method: string) => {
      switch (method) {
        case "config.get":
          return { hash: "hash-1", config: {} };
        case "channels.start":
          return {};
        case "web.login.start":
          return { connected: true, message: "Already linked." };
        default:
          throw new Error(`unexpected method: ${method}`);
      }
    });

    await connectWhatsApp(state, false);

    expect(state.whatsappLoginConnected).toBe(true);
    expect(state.whatsappLoginMessage).toBe("Already linked.");
    expect(request).not.toHaveBeenCalledWith("web.login.wait", expect.anything());
    expect(state.whatsappBusy).toBe(false);
  });
});

describe("channels controller allowed contacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockConfig(request: ReturnType<typeof requireClientRequest>, channelConfig: unknown) {
    request.mockImplementation(async (method: string) => {
      if (method === "config.get") {
        return { hash: "hash-1", config: { channels: { whatsapp: channelConfig } } };
      }
      if (method === "config.patch") {
        return {};
      }
      throw new Error(`unexpected method: ${method}`);
    });
  }

  it("adds a contact and defaults dmPolicy to allowlist on the first add", async () => {
    const state = createState();
    const request = requireClientRequest(state);
    mockConfig(request, { enabled: true });

    await addAllowedContact(state, "whatsapp", " +15555550123 ");

    expect(request).toHaveBeenCalledWith("config.patch", {
      raw: JSON.stringify({
        channels: {
          whatsapp: { allowFrom: ["+15555550123"], dmPolicy: "allowlist" },
        },
      }),
      baseHash: "hash-1",
    });
  });

  it("appends without touching an explicit dmPolicy and skips duplicates", async () => {
    const state = createState();
    const request = requireClientRequest(state);
    mockConfig(request, { dmPolicy: "pairing", allowFrom: ["+111"] });

    await addAllowedContact(state, "whatsapp", "+111");
    expect(request).not.toHaveBeenCalledWith("config.patch", expect.anything());

    await addAllowedContact(state, "whatsapp", "+222");
    expect(request).toHaveBeenCalledWith("config.patch", {
      raw: JSON.stringify({ channels: { whatsapp: { allowFrom: ["+111", "+222"] } } }),
      baseHash: "hash-1",
    });
  });

  it("removes a contact with replacePaths so the gateway accepts the shrink", async () => {
    const state = createState();
    const request = requireClientRequest(state);
    mockConfig(request, { allowFrom: ["+111", "+222"] });

    await removeAllowedContact(state, "whatsapp", "+111");

    expect(request).toHaveBeenCalledWith("config.patch", {
      raw: JSON.stringify({ channels: { whatsapp: { allowFrom: ["+222"] } } }),
      baseHash: "hash-1",
      replacePaths: ["channels.whatsapp.allowFrom"],
    });
  });

  it("stores a contact label alongside a new contact", async () => {
    const state = createState();
    const request = requireClientRequest(state);
    mockConfig(request, { dmPolicy: "allowlist", allowFrom: ["+111"] });

    await addAllowedContacts(state, "whatsapp", ["+222"], { "+222": " Aasrith " });

    expect(request).toHaveBeenCalledWith("config.patch", {
      raw: JSON.stringify({
        channels: {
          whatsapp: { allowFrom: ["+111", "+222"], contactLabels: { "+222": "Aasrith" } },
        },
      }),
      baseHash: "hash-1",
    });
  });

  it("labels an already-listed contact without rewriting allowFrom", async () => {
    const state = createState();
    const request = requireClientRequest(state);
    mockConfig(request, { dmPolicy: "allowlist", allowFrom: ["+111"] });

    await addAllowedContacts(state, "whatsapp", ["+111"], { "+111": "Abhinash" });

    expect(request).toHaveBeenCalledWith("config.patch", {
      raw: JSON.stringify({
        channels: { whatsapp: { contactLabels: { "+111": "Abhinash" } } },
      }),
      baseHash: "hash-1",
    });
  });

  it("renames a contact by merging only that label key", async () => {
    const state = createState();
    const request = requireClientRequest(state);
    mockConfig(request, {
      allowFrom: ["+111", "+222"],
      contactLabels: { "+111": "Old name", "+222": "Kept" },
    });

    await renameAllowedContact(state, "whatsapp", "+111", "New name");

    expect(request).toHaveBeenCalledWith("config.patch", {
      raw: JSON.stringify({
        channels: { whatsapp: { contactLabels: { "+111": "New name" } } },
      }),
      baseHash: "hash-1",
    });
  });

  it("clears a label with a merge-patch null delete when renamed to empty", async () => {
    const state = createState();
    const request = requireClientRequest(state);
    mockConfig(request, {
      allowFrom: ["+111", "+222"],
      contactLabels: { "+111": "Aasrith", "+222": "Kept" },
    });

    await renameAllowedContact(state, "whatsapp", "+111", "  ");

    // replacePaths only applies to arrays on the gateway; label keys must be
    // deleted with RFC 7396 nulls or they silently survive the merge.
    expect(request).toHaveBeenCalledWith("config.patch", {
      raw: JSON.stringify({
        channels: { whatsapp: { contactLabels: { "+111": null } } },
      }),
      baseHash: "hash-1",
    });
  });

  it("drops the contact's label when the contact is removed", async () => {
    const state = createState();
    const request = requireClientRequest(state);
    mockConfig(request, {
      allowFrom: ["+111", "+222"],
      contactLabels: { "+111": "Aasrith", "+222": "Kept" },
    });

    await removeAllowedContact(state, "whatsapp", "+111");

    expect(request).toHaveBeenCalledWith("config.patch", {
      raw: JSON.stringify({
        channels: { whatsapp: { allowFrom: ["+222"], contactLabels: { "+111": null } } },
      }),
      baseHash: "hash-1",
      replacePaths: ["channels.whatsapp.allowFrom"],
    });
  });
});

describe("loadChannels", () => {
  it("keeps a stale slow probe from replacing a newer non-probe snapshot", async () => {
    const state = createState();
    const request = vi.mocked(state.client!["request"]);
    const slowProbe = createDeferred<ChannelsStatusSnapshot | null>();
    const fastRuntime = createDeferred<ChannelsStatusSnapshot | null>();
    request.mockImplementation(async (_method: string, params?: unknown) => {
      if ((params as { probe?: boolean } | undefined)?.probe) {
        return slowProbe.promise;
      }
      return fastRuntime.promise;
    });

    const probeLoad = loadChannels(state, true, { softTimeoutMs: 1 });
    await probeLoad;
    const runtimeLoad = loadChannels(state, false);
    expect(request).toHaveBeenCalledTimes(2);

    fastRuntime.resolve(createChannelsSnapshot("fresh"));
    await runtimeLoad;
    expect(state.channelsSnapshot?.channelLabels.test).toBe("fresh");

    slowProbe.resolve(createChannelsSnapshot("stale"));
    await Promise.resolve();

    expect(state.channelsSnapshot?.channelLabels.test).toBe("fresh");
    expect(state.channelsLoading).toBe(false);
  });

  it("returns after a soft timeout while preserving the stale snapshot", async () => {
    vi.useFakeTimers();
    try {
      const state = createState();
      const previous: ChannelsStatusSnapshot = {
        ts: 1,
        channelOrder: ["nostr"],
        channelLabels: { nostr: "Nostr" },
        channels: {},
        channelAccounts: {},
        channelDefaultAccountId: {},
      };
      const next: ChannelsStatusSnapshot = {
        ...previous,
        ts: 2,
      };
      const deferred = createDeferred<ChannelsStatusSnapshot | null>();
      const request = requireClientRequest(state);
      request.mockReturnValueOnce(deferred.promise);
      state.channelsSnapshot = previous;
      state.channelsLastSuccess = 10;

      const load = loadChannels(state, true, { softTimeoutMs: 100 });
      await vi.advanceTimersByTimeAsync(100);
      await load;

      expect(state.channelsLoading).toBe(true);
      expect(state.channelsSnapshot).toBe(previous);
      expect(state.channelsLastSuccess).toBe(10);

      deferred.resolve(next);
      await Promise.resolve();
      await Promise.resolve();

      expect(state.channelsLoading).toBe(false);
      expect(state.channelsSnapshot).toBe(next);
      expect(state.channelsLastSuccess).toBeGreaterThan(10);
    } finally {
      vi.useRealTimers();
    }
  });
});
