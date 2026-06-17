// Browser tests cover server context.ensure browser available.waits for cdp ready plugin behavior.
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import "./server-context.chrome-test-harness.js";
import {
  PROFILE_ATTACH_RETRY_TIMEOUT_MS,
  PROFILE_HTTP_REACHABILITY_TIMEOUT_MS,
} from "./cdp-timeouts.js";
import * as chromeModule from "./chrome.js";
import { BrowserProfileUnavailableError } from "./errors.js";
import { createBrowserRouteContext } from "./server-context.js";
import { makeBrowserServerState, mockLaunchedChrome } from "./server-context.test-harness.js";

function setupEnsureBrowserAvailableHarness() {
  vi.useFakeTimers();

  const launchDaisyClawChrome = vi.mocked(chromeModule.launchDaisyClawChrome);
  const stopDaisyClawChrome = vi.mocked(chromeModule.stopDaisyClawChrome);
  const isChromeReachable = vi.mocked(chromeModule.isChromeReachable);
  const isChromeCdpReady = vi.mocked(chromeModule.isChromeCdpReady);
  isChromeReachable.mockResolvedValue(false);

  const state = makeBrowserServerState();
  const ctx = createBrowserRouteContext({ getState: () => state });
  const profile = ctx.forProfile("daisyclaw");

  return { launchDaisyClawChrome, stopDaisyClawChrome, isChromeCdpReady, profile, state };
}

function createAttachOnlyLoopbackProfile(cdpUrl: string) {
  const state = makeBrowserServerState({
    profile: {
      name: "manual-cdp",
      cdpUrl,
      cdpHost: "127.0.0.1",
      cdpIsLoopback: true,
      cdpPort: 9222,
      color: "#00AA00",
      driver: "daisyclaw",
      headless: false,
      attachOnly: true,
    },
    resolvedOverrides: {
      defaultProfile: "manual-cdp",
      ssrfPolicy: {},
    },
  });
  const ctx = createBrowserRouteContext({ getState: () => state });
  return { profile: ctx.forProfile("manual-cdp"), state };
}

function requireFirstLaunchOptions(launchDaisyClawChrome: {
  mock: { calls: unknown[][] };
}): unknown {
  const [call] = launchDaisyClawChrome.mock.calls;
  if (!call) {
    throw new Error("expected Chrome launch call");
  }
  return call[2];
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("browser server-context ensureBrowserAvailable", () => {
  it("waits for CDP readiness after launching to avoid follow-up PortInUseError races (#21149)", async () => {
    const { launchDaisyClawChrome, stopDaisyClawChrome, isChromeCdpReady, profile } =
      setupEnsureBrowserAvailableHarness();
    isChromeCdpReady.mockResolvedValueOnce(false).mockResolvedValue(true);
    mockLaunchedChrome(launchDaisyClawChrome, 123);

    const promise = profile.ensureBrowserAvailable();
    await vi.advanceTimersByTimeAsync(100);
    await expect(promise).resolves.toBeUndefined();

    expect(launchDaisyClawChrome).toHaveBeenCalledTimes(1);
    expect(isChromeCdpReady).toHaveBeenCalled();
    expect(stopDaisyClawChrome).not.toHaveBeenCalled();
  });

  it("stops launched chrome when CDP readiness never arrives", async () => {
    const { launchDaisyClawChrome, stopDaisyClawChrome, isChromeCdpReady, profile } =
      setupEnsureBrowserAvailableHarness();
    isChromeCdpReady.mockResolvedValue(false);
    mockLaunchedChrome(launchDaisyClawChrome, 321);

    const promise = profile.ensureBrowserAvailable();
    const rejected = expect(promise).rejects.toThrow("not reachable after start");
    const diagnosticRejected = expect(promise).rejects.toThrow(
      "CDP diagnostic: websocket_health_command_timeout; mock CDP diagnostic.",
    );
    await vi.advanceTimersByTimeAsync(8100);
    await rejected;
    await diagnosticRejected;

    expect(launchDaisyClawChrome).toHaveBeenCalledTimes(1);
    expect(stopDaisyClawChrome).toHaveBeenCalledTimes(1);
  });

  it("uses configured local CDP readiness timeout after launching", async () => {
    const { launchDaisyClawChrome, stopDaisyClawChrome, isChromeCdpReady, profile, state } =
      setupEnsureBrowserAvailableHarness();
    state.resolved.localCdpReadyTimeoutMs = 250;
    isChromeCdpReady.mockResolvedValue(false);
    mockLaunchedChrome(launchDaisyClawChrome, 322);

    const promise = profile.ensureBrowserAvailable();
    const rejected = expect(promise).rejects.toThrow("not reachable after start");
    await vi.advanceTimersByTimeAsync(300);
    await rejected;

    expect(launchDaisyClawChrome).toHaveBeenCalledTimes(1);
    expect(stopDaisyClawChrome).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent lazy-start calls to prevent PortInUseError", async () => {
    const { launchDaisyClawChrome, stopDaisyClawChrome, isChromeCdpReady, profile } =
      setupEnsureBrowserAvailableHarness();
    isChromeCdpReady.mockResolvedValue(true);
    mockLaunchedChrome(launchDaisyClawChrome, 456);

    const first = profile.ensureBrowserAvailable();
    const second = profile.ensureBrowserAvailable();
    await vi.advanceTimersByTimeAsync(100);
    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);

    expect(launchDaisyClawChrome).toHaveBeenCalledTimes(1);
    expect(stopDaisyClawChrome).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent lazy-start calls across fresh profile contexts", async () => {
    const { launchDaisyClawChrome, stopDaisyClawChrome, isChromeCdpReady, state } =
      setupEnsureBrowserAvailableHarness();
    isChromeCdpReady.mockResolvedValue(true);
    mockLaunchedChrome(launchDaisyClawChrome, 457);

    const firstCtx = createBrowserRouteContext({ getState: () => state });
    const secondCtx = createBrowserRouteContext({ getState: () => state });
    const first = firstCtx.forProfile("daisyclaw").ensureBrowserAvailable();
    const second = secondCtx.forProfile("daisyclaw").ensureBrowserAvailable();
    await vi.advanceTimersByTimeAsync(100);
    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);

    expect(launchDaisyClawChrome).toHaveBeenCalledTimes(1);
    expect(stopDaisyClawChrome).not.toHaveBeenCalled();
  });

  it("passes request-local headless override to initial launch", async () => {
    const { launchDaisyClawChrome, stopDaisyClawChrome, isChromeCdpReady, profile } =
      setupEnsureBrowserAvailableHarness();
    isChromeCdpReady.mockResolvedValue(true);
    mockLaunchedChrome(launchDaisyClawChrome, 654);

    const promise = profile.ensureBrowserAvailable({ headless: true });
    await vi.advanceTimersByTimeAsync(100);
    await expect(promise).resolves.toBeUndefined();

    expect(launchDaisyClawChrome).toHaveBeenCalledTimes(1);
    expect(requireFirstLaunchOptions(launchDaisyClawChrome)).toEqual({ headlessOverride: true });
    expect(stopDaisyClawChrome).not.toHaveBeenCalled();
  });

  it("passes request-local headless override to the owned restart path", async () => {
    const { launchDaisyClawChrome, stopDaisyClawChrome, isChromeCdpReady, profile, state } =
      setupEnsureBrowserAvailableHarness();
    const isChromeReachable = vi.mocked(chromeModule.isChromeReachable);
    const existingProc = new EventEmitter() as unknown as ChildProcessWithoutNullStreams;
    state.profiles.set("daisyclaw", {
      profile: profile.profile,
      running: {
        pid: 111,
        exe: { kind: "chromium", path: "/usr/bin/chromium" },
        userDataDir: "/tmp/daisyclaw-test",
        cdpPort: 18800,
        startedAt: Date.now(),
        proc: existingProc,
      },
      lastTargetId: null,
      reconcile: null,
    });
    isChromeReachable.mockResolvedValue(true);
    isChromeCdpReady.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    mockLaunchedChrome(launchDaisyClawChrome, 987);

    await expect(profile.ensureBrowserAvailable({ headless: true })).resolves.toBeUndefined();

    expect(stopDaisyClawChrome).toHaveBeenCalledTimes(1);
    expect(launchDaisyClawChrome).toHaveBeenCalledTimes(1);
    expect(requireFirstLaunchOptions(launchDaisyClawChrome)).toEqual({ headlessOverride: true });
  });

  it("does not share inflight lazy-start promises across different headless overrides", async () => {
    const { launchDaisyClawChrome, isChromeCdpReady, profile } =
      setupEnsureBrowserAvailableHarness();
    const isChromeReachable = vi.mocked(chromeModule.isChromeReachable);
    isChromeReachable.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    isChromeCdpReady.mockResolvedValue(true);
    mockLaunchedChrome(launchDaisyClawChrome, 456);

    const first = profile.ensureBrowserAvailable();
    const second = profile.ensureBrowserAvailable({ headless: true });
    await vi.advanceTimersByTimeAsync(100);
    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);

    expect(launchDaisyClawChrome).toHaveBeenCalledTimes(1);
    expect(isChromeReachable.mock.calls.length).toBeGreaterThan(1);
  });

  it("clears the concurrent lazy-start guard after launch failure", async () => {
    const { launchDaisyClawChrome, stopDaisyClawChrome, isChromeCdpReady, profile } =
      setupEnsureBrowserAvailableHarness();
    isChromeCdpReady.mockResolvedValue(true);
    launchDaisyClawChrome.mockRejectedValueOnce(
      new Error("PortInUseError: listen EADDRINUSE 127.0.0.1:18800"),
    );

    const first = profile.ensureBrowserAvailable();
    const second = profile.ensureBrowserAvailable();
    await expect(Promise.all([first, second])).rejects.toThrow("PortInUseError");

    mockLaunchedChrome(launchDaisyClawChrome, 789);
    const retry = profile.ensureBrowserAvailable();
    await vi.advanceTimersByTimeAsync(100);
    await expect(retry).resolves.toBeUndefined();

    expect(launchDaisyClawChrome).toHaveBeenCalledTimes(2);
    expect(stopDaisyClawChrome).not.toHaveBeenCalled();
  });

  it("cools down repeated managed Chrome launch failures across route contexts", async () => {
    const { launchDaisyClawChrome, stopDaisyClawChrome, isChromeCdpReady, state } =
      setupEnsureBrowserAvailableHarness();
    isChromeCdpReady.mockResolvedValue(true);
    launchDaisyClawChrome.mockRejectedValue(new Error("Failed to start Chrome CDP"));

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const ctx = createBrowserRouteContext({ getState: () => state });
      await expect(ctx.forProfile("daisyclaw").ensureBrowserAvailable()).rejects.toThrow(
        "Failed to start Chrome CDP",
      );
    }

    const cooledDownCtx = createBrowserRouteContext({ getState: () => state });
    await expect(cooledDownCtx.forProfile("daisyclaw").ensureBrowserAvailable()).rejects.toThrow(
      'Browser launch for profile "daisyclaw" is cooling down after 3 consecutive managed Chrome launch failures.',
    );
    await expect(cooledDownCtx.forProfile("daisyclaw").ensureBrowserAvailable()).rejects.toThrow(
      "set browser.enabled=false if the browser tool is not needed",
    );

    expect(launchDaisyClawChrome).toHaveBeenCalledTimes(3);
    expect(stopDaisyClawChrome).not.toHaveBeenCalled();
  });

  it("allows one managed Chrome launch attempt after the cooldown expires", async () => {
    const { launchDaisyClawChrome, isChromeCdpReady, state } = setupEnsureBrowserAvailableHarness();
    isChromeCdpReady.mockResolvedValue(true);
    launchDaisyClawChrome.mockRejectedValue(new Error("Failed to start Chrome CDP"));

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const ctx = createBrowserRouteContext({ getState: () => state });
      await expect(ctx.forProfile("daisyclaw").ensureBrowserAvailable()).rejects.toThrow(
        "Failed to start Chrome CDP",
      );
    }

    await vi.advanceTimersByTimeAsync(30_000);
    const retryCtx = createBrowserRouteContext({ getState: () => state });
    await expect(retryCtx.forProfile("daisyclaw").ensureBrowserAvailable()).rejects.toThrow(
      "Failed to start Chrome CDP",
    );

    expect(launchDaisyClawChrome).toHaveBeenCalledTimes(4);
  });

  it("reuses a pre-existing loopback browser after an initial short probe miss", async () => {
    const { launchDaisyClawChrome, stopDaisyClawChrome, isChromeCdpReady, profile, state } =
      setupEnsureBrowserAvailableHarness();
    const isChromeReachable = vi.mocked(chromeModule.isChromeReachable);
    state.resolved.ssrfPolicy = {};

    isChromeReachable.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    isChromeCdpReady.mockResolvedValueOnce(true);

    await expect(profile.ensureBrowserAvailable()).resolves.toBeUndefined();

    expect(isChromeReachable).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:18800",
      PROFILE_HTTP_REACHABILITY_TIMEOUT_MS,
      undefined,
    );
    expect(isChromeReachable).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:18800",
      PROFILE_ATTACH_RETRY_TIMEOUT_MS,
      undefined,
    );
    expect(launchDaisyClawChrome).not.toHaveBeenCalled();
    expect(stopDaisyClawChrome).not.toHaveBeenCalled();
  });

  it("explains attachOnly for externally managed loopback CDP services", async () => {
    const { launchDaisyClawChrome, stopDaisyClawChrome, isChromeCdpReady, profile } =
      setupEnsureBrowserAvailableHarness();
    const isChromeReachable = vi.mocked(chromeModule.isChromeReachable);

    isChromeReachable.mockResolvedValue(true);
    isChromeCdpReady.mockResolvedValue(false);

    const promise = profile.ensureBrowserAvailable();
    await expect(promise).rejects.toThrow(
      'Port 18800 is in use for profile "daisyclaw" but not by daisyclaw.',
    );
    await expect(promise).rejects.toThrow(
      "set browser.profiles.daisyclaw.attachOnly=true so DaisyClaw attaches without trying to manage the local process",
    );
    await expect(promise).rejects.toThrow(
      "For Browserless Docker, set EXTERNAL to the same WebSocket endpoint DaisyClaw can reach via browser.profiles.<name>.cdpUrl.",
    );

    expect(launchDaisyClawChrome).not.toHaveBeenCalled();
    expect(stopDaisyClawChrome).not.toHaveBeenCalled();
  });

  it("retries remote CDP websocket reachability once before failing", async () => {
    const { launchDaisyClawChrome, stopDaisyClawChrome, isChromeCdpReady } =
      setupEnsureBrowserAvailableHarness();
    const isChromeReachable = vi.mocked(chromeModule.isChromeReachable);

    const state = makeBrowserServerState();
    state.resolved.profiles.daisyclaw = {
      cdpUrl: "ws://browserless:3001",
      color: "#00AA00",
    };
    const ctx = createBrowserRouteContext({ getState: () => state });
    const profile = ctx.forProfile("daisyclaw");
    const expectedRemoteHttpTimeoutMs = state.resolved.remoteCdpTimeoutMs;
    const expectedRemoteWsTimeoutMs = state.resolved.remoteCdpHandshakeTimeoutMs;

    isChromeReachable.mockResolvedValueOnce(true);
    isChromeCdpReady.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await expect(profile.ensureBrowserAvailable()).resolves.toBeUndefined();

    expect(isChromeReachable).toHaveBeenCalledTimes(1);
    expect(isChromeCdpReady).toHaveBeenCalledTimes(2);
    expect(isChromeCdpReady).toHaveBeenNthCalledWith(
      1,
      "ws://browserless:3001",
      expectedRemoteHttpTimeoutMs,
      expectedRemoteWsTimeoutMs,
      {
        allowPrivateNetwork: true,
      },
    );
    expect(isChromeCdpReady).toHaveBeenNthCalledWith(
      2,
      "ws://browserless:3001",
      expectedRemoteHttpTimeoutMs,
      expectedRemoteWsTimeoutMs,
      {
        allowPrivateNetwork: true,
      },
    );
    expect(launchDaisyClawChrome).not.toHaveBeenCalled();
    expect(stopDaisyClawChrome).not.toHaveBeenCalled();
  });

  it("treats attachOnly loopback CDP as local control with remote-class probe timeouts", async () => {
    const { launchDaisyClawChrome, stopDaisyClawChrome } = setupEnsureBrowserAvailableHarness();
    const isChromeReachable = vi.mocked(chromeModule.isChromeReachable);
    const isChromeCdpReady = vi.mocked(chromeModule.isChromeCdpReady);

    const { profile, state } = createAttachOnlyLoopbackProfile("http://127.0.0.1:9222");

    isChromeReachable.mockResolvedValueOnce(true);
    isChromeCdpReady.mockResolvedValueOnce(true);

    await expect(profile.ensureBrowserAvailable()).resolves.toBeUndefined();

    expect(isChromeReachable).toHaveBeenCalledWith(
      "http://127.0.0.1:9222",
      state.resolved.remoteCdpTimeoutMs,
      undefined,
    );
    expect(isChromeCdpReady).toHaveBeenCalledWith(
      "http://127.0.0.1:9222",
      state.resolved.remoteCdpTimeoutMs,
      state.resolved.remoteCdpHandshakeTimeoutMs,
      undefined,
    );
    expect(launchDaisyClawChrome).not.toHaveBeenCalled();
    expect(stopDaisyClawChrome).not.toHaveBeenCalled();
  });

  it("resolves for attachOnly loopback profile with a bare ws:// cdpUrl when CDP is reachable (#68027)", async () => {
    // Regression for #68027: a bare `ws://host:port` cdpUrl on a loopback
    // attachOnly profile must not surface as
    //   `Browser attachOnly is enabled and profile "<name>" is not running.`
    // when the underlying CDP endpoint is actually healthy. The low-level
    // fix lives in chrome.ts/cdp.ts (see chrome.test.ts #68027 tests); this
    // higher-level test locks the user-facing symptom at
    // ensureBrowserAvailable() so future refactors of the availability flow
    // cannot silently reintroduce the bug by munging/short-circuiting bare
    // ws:// URLs before they reach the helpers.
    const { launchDaisyClawChrome, stopDaisyClawChrome } = setupEnsureBrowserAvailableHarness();
    const isChromeReachable = vi.mocked(chromeModule.isChromeReachable);
    const isChromeCdpReady = vi.mocked(chromeModule.isChromeCdpReady);

    const { profile, state } = createAttachOnlyLoopbackProfile("ws://127.0.0.1:9222");

    isChromeReachable.mockResolvedValueOnce(true);
    isChromeCdpReady.mockResolvedValueOnce(true);

    await expect(profile.ensureBrowserAvailable()).resolves.toBeUndefined();

    // The bare ws:// URL must pass through unchanged — the helpers own the
    // discovery-first-then-fallback strategy for bare ws roots.
    expect(isChromeReachable).toHaveBeenCalledWith(
      "ws://127.0.0.1:9222",
      state.resolved.remoteCdpTimeoutMs,
      undefined,
    );
    expect(isChromeCdpReady).toHaveBeenCalledWith(
      "ws://127.0.0.1:9222",
      state.resolved.remoteCdpTimeoutMs,
      state.resolved.remoteCdpHandshakeTimeoutMs,
      undefined,
    );
    expect(launchDaisyClawChrome).not.toHaveBeenCalled();
    expect(stopDaisyClawChrome).not.toHaveBeenCalled();
  });

  it("redacts credentials in remote CDP availability errors", async () => {
    const { launchDaisyClawChrome, stopDaisyClawChrome } = setupEnsureBrowserAvailableHarness();
    const isChromeReachable = vi.mocked(chromeModule.isChromeReachable);

    const state = makeBrowserServerState({
      profile: {
        name: "remote",
        cdpUrl: "https://user:pass@browserless.example.com?token=supersecret123",
        cdpHost: "browserless.example.com",
        cdpIsLoopback: false,
        cdpPort: 443,
        color: "#00AA00",
        driver: "daisyclaw",
        headless: false,
        attachOnly: false,
      },
      resolvedOverrides: {
        defaultProfile: "remote",
        ssrfPolicy: {},
      },
    });
    const ctx = createBrowserRouteContext({ getState: () => state });
    const profile = ctx.forProfile("remote");

    isChromeReachable.mockResolvedValue(false);

    const promise = profile.ensureBrowserAvailable();
    await expect(promise).rejects.toThrow(BrowserProfileUnavailableError);
    await expect(promise).rejects.toThrow(
      'Remote CDP for profile "remote" is not reachable at https://browserless.example.com/?token=***.',
    );

    expect(launchDaisyClawChrome).not.toHaveBeenCalled();
    expect(stopDaisyClawChrome).not.toHaveBeenCalled();
  });
});
