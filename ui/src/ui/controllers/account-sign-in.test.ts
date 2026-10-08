import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SkillStatusEntry } from "../types.ts";
import type { AccountSignInStatus } from "../views/account-sign-in.ts";
import {
  disconnectAccountSignIn,
  INITIAL_ACCOUNT_SIGN_IN,
  loadAccountSignIn,
  saveGoogleClientFile,
  startAccountSignIn,
  type AccountSignInHost,
} from "./account-sign-in.ts";

function baseStatus(): AccountSignInStatus {
  return {
    google: { installed: true, hasClient: true, accounts: [] },
    spotify: { installed: false, connected: false },
    jobs: {},
  };
}

function host(handler: (method: string, params?: unknown) => unknown) {
  const request = vi.fn(async (method: string, params?: unknown) => handler(method, params));
  const value: AccountSignInHost = {
    client: { request: request as NonNullable<AccountSignInHost["client"]>["request"] },
    connected: true,
    hello: { features: { methods: ["connections.status"] } },
    skillsReport: {
      skills: [
        {
          skillKey: "spotify-player",
          name: "spotify-player",
          install: [{ id: "download-win-x64", kind: "download", label: "x", bins: [] }],
        } as unknown as SkillStatusEntry,
      ],
    },
    accountSignIn: INITIAL_ACCOUNT_SIGN_IN,
  };
  return { host: value, request };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("account sign-in", () => {
  it("knows an older engine cannot sign in, without asking it", async () => {
    const { host: h, request } = host(() => ({}));
    h.hello = { features: { methods: ["chat.history"] } };
    await loadAccountSignIn(h);
    expect(h.accountSignIn.unsupported).toBe(true);
    expect(request).not.toHaveBeenCalled();
  });

  it("installs a missing tool, signs in, and turns the skill on once the login is confirmed", async () => {
    let status = baseStatus();
    let jobState: "running" | "succeeded" = "running";
    const { host: h, request } = host((method, params) => {
      if (method === "connections.status") {
        const jobs = { spotify: { state: jobState } };
        return (params as { jobsOnly?: boolean })?.jobsOnly ? { jobs } : { ...status, jobs };
      }
      if (method === "skills.install") {
        status = { ...status, spotify: { installed: true, connected: false } };
        return {};
      }
      if (method === "connections.connect") {
        return { job: { state: "running" } };
      }
      return {};
    });
    const reloadSkills = vi.fn();
    await loadAccountSignIn(h);
    await startAccountSignIn(h, "spotify", { reloadSkills });
    expect(request).toHaveBeenCalledWith(
      "skills.install",
      { name: "spotify-player", installId: "download-win-x64", timeoutMs: 120_000 },
      { timeoutMs: 150_000 },
    );
    expect(request).toHaveBeenCalledWith("connections.connect", { service: "spotify" });
    expect(request).not.toHaveBeenCalledWith("skills.update", expect.anything());

    jobState = "succeeded";
    status = { ...status, spotify: { installed: true, connected: true } };
    await vi.advanceTimersByTimeAsync(2_100);
    expect(request).toHaveBeenCalledWith("skills.update", {
      skillKey: "spotify-player",
      enabled: true,
    });
    expect(reloadSkills).toHaveBeenCalled();
    expect(h.accountSignIn.status?.spotify.connected).toBe(true);
    expect(h.accountSignIn.notice.spotify).toEqual({
      kind: "success",
      message: 'Spotify connected. Try asking Daisy "What\'s playing?"',
    });
  });

  it("reports a failed sign-in in the gateway's words and leaves the skill off", async () => {
    let jobs: Record<string, unknown> = { google: { state: "running" } };
    const { host: h, request } = host((method, params) => {
      if (method === "connections.status") {
        return (params as { jobsOnly?: boolean })?.jobsOnly ? { jobs } : { ...baseStatus(), jobs };
      }
      if (method === "connections.connect") {
        return { job: { state: "running" } };
      }
      return {};
    });
    await loadAccountSignIn(h);
    h.accountSignIn = { ...h.accountSignIn, googleEmail: "me@gmail.com" };
    await startAccountSignIn(h, "google");
    expect(request).toHaveBeenCalledWith("connections.connect", {
      service: "google",
      email: "me@gmail.com",
    });
    jobs = { google: { state: "failed", message: "Access blocked: the app is in testing" } };
    await vi.advanceTimersByTimeAsync(2_100);
    expect(h.accountSignIn.notice.google).toEqual({
      kind: "error",
      message: "Access blocked: the app is in testing",
    });
    expect(request).not.toHaveBeenCalledWith("skills.update", expect.anything());
  });

  it("needs a Google address before starting", async () => {
    const { host: h, request } = host(() => baseStatus());
    await startAccountSignIn(h, "google");
    expect(h.accountSignIn.notice.google?.message).toBe("Enter your Google address first.");
    expect(request).not.toHaveBeenCalledWith("connections.connect", expect.anything());
  });

  it("saves the Google sign-in file and says what to do next", async () => {
    const { host: h, request } = host((method) =>
      method === "connections.status" ? baseStatus() : {},
    );
    await loadAccountSignIn(h);
    await saveGoogleClientFile(h, { size: 20, text: async () => '{"installed":{}}' });
    expect(request).toHaveBeenCalledWith("connections.google.setClient", {
      credentialsJson: '{"installed":{}}',
    });
    expect(h.accountSignIn.notice.google?.kind).toBe("success");
  });

  it("shows the gateway's reason when the file is wrong", async () => {
    const { host: h } = host((method) => {
      if (method === "connections.google.setClient") {
        throw new Error('That file is for a "Web application" client.');
      }
      return baseStatus();
    });
    await loadAccountSignIn(h);
    await saveGoogleClientFile(h, { size: 20, text: async () => "{}" });
    expect(h.accountSignIn.notice.google).toEqual({
      kind: "error",
      message: 'That file is for a "Web application" client.',
    });
  });

  it("turns the skill off when the last account is disconnected, after asking", async () => {
    const { host: h, request } = host((method) =>
      method === "connections.status" ? baseStatus() : {},
    );
    const confirm = vi.fn(async () => true);
    await disconnectAccountSignIn(h, "google", "me@gmail.com", {}, confirm);
    expect(confirm).toHaveBeenCalled();
    expect(request).toHaveBeenCalledWith("connections.disconnect", {
      service: "google",
      email: "me@gmail.com",
    });
    expect(request).toHaveBeenCalledWith("skills.update", { skillKey: "gog", enabled: false });

    request.mockClear();
    await disconnectAccountSignIn(h, "google", "me@gmail.com", {}, async () => false);
    expect(request).not.toHaveBeenCalled();
  });
});
