import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AccountConnectionError,
  cancelAccountConnect,
  disconnectAccount,
  getAccountConnectionJobs,
  getAccountConnectionsStatus,
  resetAccountConnectionJobsForTest,
  setGoogleClient,
  startAccountConnect,
  validateGoogleClientFile,
  type AccountConnectionDeps,
  type RunOptions,
  type RunResult,
} from "./account-connections.js";

const HOME = path.join("C:", "Users", "someone");
const SPOTIFY_TOKEN = path.join(HOME, ".cache", "spotify-player", "user_client_token.json");
const DESKTOP_CLIENT = JSON.stringify({
  installed: { client_id: "id.apps.googleusercontent.com", client_secret: "secret" },
});

function ok(stdout = ""): RunResult {
  return { code: 0, stdout, stderr: "", timedOut: false, aborted: false };
}

type Pending = { args: readonly string[]; opts: RunOptions; finish: (result: RunResult) => void };

function fakeDeps(
  overrides: {
    bins?: Record<string, string | null>;
    accounts?: string[];
    /** What Google said about an account's saved sign-in, when it turned it down. */
    checkErrors?: Record<string, string>;
    /** The --check run printed nothing usable (an older gog, or it failed). */
    checkUnusable?: boolean;
    clients?: number;
    files?: Set<string>;
  } = {},
) {
  const state = {
    accounts: overrides.accounts ?? [],
    clients: overrides.clients ?? 0,
    files: overrides.files ?? new Set<string>(),
    written: new Map<string, string>(),
    removed: [] as string[],
    calls: [] as Array<readonly string[]>,
    pending: [] as Pending[],
  };
  const bins = overrides.bins ?? { gog: "gog.exe", spotify_player: "spotify_player.exe" };
  const deps: AccountConnectionDeps = {
    findBinary: (bin) => bins[bin] ?? null,
    run: (_command, args, opts) => {
      state.calls.push(args);
      const joined = args.join(" ");
      if (joined.startsWith("auth credentials list")) {
        return Promise.resolve(
          ok(JSON.stringify({ clients: Array.from({ length: state.clients }, () => ({})) })),
        );
      }
      if (joined.startsWith("auth list --check")) {
        if (overrides.checkUnusable) {
          return Promise.resolve({ ...ok("unknown flag --check"), code: 1 });
        }
        return Promise.resolve(
          ok(
            JSON.stringify({
              accounts: state.accounts.map((email) => {
                const error = overrides.checkErrors?.[email];
                return error ? { email, valid: false, error } : { email, valid: true };
              }),
            }),
          ),
        );
      }
      if (joined.startsWith("auth list")) {
        return Promise.resolve(
          ok(JSON.stringify({ accounts: state.accounts.map((email) => ({ email })) })),
        );
      }
      if (joined.startsWith("auth credentials set") || joined.startsWith("auth remove")) {
        return Promise.resolve(ok());
      }
      // A sign-in: stays open until the test finishes it.
      return new Promise<RunResult>((resolve) => {
        const pending: Pending = { args, opts, finish: resolve };
        state.pending.push(pending);
        opts.signal?.addEventListener("abort", () =>
          resolve({ code: null, stdout: "", stderr: "", timedOut: false, aborted: true }),
        );
      });
    },
    fileExists: async (filePath) => state.files.has(filePath),
    writePrivateFile: async (filePath, contents) => {
      state.written.set(filePath, contents);
    },
    removeFile: async (filePath) => {
      state.removed.push(filePath);
      state.files.delete(filePath);
    },
    homeDir: () => HOME,
    tmpDir: () => path.join("C:", "tmp"),
    now: () => 1_000,
  };
  return { deps, state };
}

async function flush() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

afterEach(() => {
  resetAccountConnectionJobsForTest();
  vi.restoreAllMocks();
});

describe("account connection status", () => {
  it("reports installed tools, the Google client, signed-in accounts and Spotify", async () => {
    const { deps } = fakeDeps({
      accounts: ["me@gmail.com"],
      clients: 1,
      files: new Set([SPOTIFY_TOKEN]),
    });
    expect(await getAccountConnectionsStatus(deps)).toEqual({
      google: {
        installed: true,
        hasClient: true,
        accounts: ["me@gmail.com"],
        expiredAccounts: [],
      },
      spotify: { installed: true, connected: true },
      jobs: {},
    });
  });

  it("says plainly when a tool is not installed, without running anything", async () => {
    const { deps, state } = fakeDeps({ bins: { gog: null, spotify_player: null } });
    expect(await getAccountConnectionsStatus(deps)).toEqual({
      google: { installed: false, hasClient: false, accounts: [], expiredAccounts: [] },
      spotify: { installed: false, connected: false },
      jobs: {},
    });
    expect(state.calls).toEqual([]);
  });

  // Google drops the saved sign-in after 7 days while the user's app is in
  // "Testing". The tile said "Connected" anyway, and a scheduled email failed.
  it("says when Google no longer accepts a saved sign-in", async () => {
    const { deps } = fakeDeps({
      accounts: ["me@gmail.com"],
      clients: 1,
      checkErrors: {
        "me@gmail.com": 'refresh access token: oauth2: "invalid_grant" "Bad Request"',
      },
    });
    expect((await getAccountConnectionsStatus(deps)).google).toMatchObject({
      accounts: ["me@gmail.com"],
      expiredAccounts: ["me@gmail.com"],
    });
  });

  it("does not call a sign-in expired just because the check could not reach Google", async () => {
    const { deps } = fakeDeps({
      accounts: ["me@gmail.com"],
      checkErrors: { "me@gmail.com": "dial tcp: lookup oauth2.googleapis.com: no such host" },
    });
    expect((await getAccountConnectionsStatus(deps)).google.expiredAccounts).toEqual([]);
  });

  it("still lists accounts when the check gives nothing usable", async () => {
    const { deps } = fakeDeps({ accounts: ["me@gmail.com"], checkUnusable: true });
    expect((await getAccountConnectionsStatus(deps)).google).toMatchObject({
      accounts: ["me@gmail.com"],
      expiredAccounts: [],
    });
  });
});

describe("the Google sign-in file", () => {
  it("accepts a Desktop app client", () => {
    expect(() => validateGoogleClientFile(DESKTOP_CLIENT)).not.toThrow();
  });

  it("explains a Web client or a wrong file instead of passing it on", () => {
    expect(() =>
      validateGoogleClientFile(JSON.stringify({ web: { client_id: "x", client_secret: "y" } })),
    ).toThrow(/Desktop app/);
    expect(() => validateGoogleClientFile("not json")).toThrow(/not the one Google gives you/);
    expect(() => validateGoogleClientFile(JSON.stringify({ installed: {} }))).toThrow(
      /Desktop app/,
    );
  });

  it("hands the file to gog through a private temporary copy that is removed afterwards", async () => {
    const { deps, state } = fakeDeps();
    await setGoogleClient(DESKTOP_CLIENT, deps);
    const [tempFile] = [...state.written.keys()];
    expect(state.written.get(tempFile)).toBe(DESKTOP_CLIENT);
    expect(state.calls).toContainEqual(["auth", "credentials", "set", tempFile, "--no-input"]);
    expect(state.removed).toContain(tempFile);
  });
});

describe("signing in", () => {
  it("runs Google's browser sign-in for the address and confirms the login was stored", async () => {
    const { deps, state } = fakeDeps({ clients: 1 });
    const job = await startAccountConnect({ service: "google", email: " me@gmail.com " }, deps);
    expect(job.state).toBe("running");
    const signIn = state.pending[0];
    expect(signIn.args).toEqual([
      "auth",
      "add",
      "me@gmail.com",
      "--services",
      "gmail,calendar,drive,contacts,docs,sheets",
      "--force-consent",
      "--no-input",
      "--force",
    ]);

    signIn.opts.onOutput?.(
      "Open https://accounts.google.com/o/oauth2/auth?client_id=x in a browser\n",
    );
    expect(getAccountConnectionJobs().google?.authUrl).toBe(
      "https://accounts.google.com/o/oauth2/auth?client_id=x",
    );

    state.accounts = ["me@gmail.com"];
    signIn.finish(ok());
    await flush();
    expect(getAccountConnectionJobs().google).toMatchObject({
      state: "succeeded",
      finishedAt: 1_000,
    });
  });

  it("does not call a finished run a success when no login was saved", async () => {
    const { deps, state } = fakeDeps({ clients: 1 });
    await startAccountConnect({ service: "google", email: "me@gmail.com" }, deps);
    state.pending[0].finish(ok());
    await flush();
    expect(getAccountConnectionJobs().google).toMatchObject({
      state: "failed",
      message: "The sign-in finished, but no login was saved. Try connecting again.",
    });
  });

  it("asks for the sign-in file before a Google sign-in, and for a real address", async () => {
    const { deps } = fakeDeps({ clients: 0 });
    await expect(
      startAccountConnect({ service: "google", email: "me@gmail.com" }, deps),
    ).rejects.toThrow(/sign-in file first/);
    const withClient = fakeDeps({ clients: 1 }).deps;
    await expect(
      startAccountConnect({ service: "google", email: "--help@x.com" }, withClient),
    ).rejects.toThrow(/Enter the Google address/);
    await expect(startAccountConnect({ service: "google" }, withClient)).rejects.toThrow(
      /Enter the Google address/,
    );
  });

  it("runs Spotify's sign-in and checks its saved login", async () => {
    const files = new Set<string>();
    const { deps, state } = fakeDeps({ files });
    await startAccountConnect({ service: "spotify" }, deps);
    expect(state.pending[0].args).toEqual(["authenticate"]);
    files.add(SPOTIFY_TOKEN);
    state.pending[0].finish(ok());
    await flush();
    expect(getAccountConnectionJobs().spotify?.state).toBe("succeeded");
  });

  it("allows one sign-in per service at a time", async () => {
    const { deps } = fakeDeps();
    await startAccountConnect({ service: "spotify" }, deps);
    await expect(startAccountConnect({ service: "spotify" }, deps)).rejects.toMatchObject({
      code: "busy",
    });
  });

  it("reports cancel, timeout and tool errors in words", async () => {
    const { deps, state } = fakeDeps();
    await startAccountConnect({ service: "spotify" }, deps);
    expect(cancelAccountConnect("spotify")).toBe(true);
    await flush();
    expect(getAccountConnectionJobs().spotify?.state).toBe("cancelled");

    await startAccountConnect({ service: "spotify" }, deps);
    state.pending[1].finish({ code: null, stdout: "", stderr: "", timedOut: true, aborted: false });
    await flush();
    expect(getAccountConnectionJobs().spotify?.message).toMatch(/within 5 minutes/);

    await startAccountConnect({ service: "spotify" }, deps);
    state.pending[2].finish({
      code: 1,
      stdout: "Browse to: https://accounts.spotify.com/authorize?x=1",
      stderr: "Error: Premium account required",
      timedOut: false,
      aborted: false,
    });
    await flush();
    expect(getAccountConnectionJobs().spotify).toMatchObject({
      state: "failed",
      message: "Error: Premium account required",
    });
  });

  it("needs the tool installed first", async () => {
    const { deps } = fakeDeps({ bins: { gog: null, spotify_player: null } });
    const attempt = startAccountConnect({ service: "spotify" }, deps);
    await expect(attempt).rejects.toBeInstanceOf(AccountConnectionError);
    await expect(attempt).rejects.toMatchObject({ code: "not_installed" });
  });
});

describe("disconnecting", () => {
  it("removes the Google account and Spotify's saved login", async () => {
    const files = new Set([SPOTIFY_TOKEN]);
    const { deps, state } = fakeDeps({ files });
    await disconnectAccount({ service: "google", email: "me@gmail.com" }, deps);
    expect(state.calls).toContainEqual(["auth", "remove", "me@gmail.com", "--force", "--no-input"]);
    await disconnectAccount({ service: "spotify" }, deps);
    expect(state.removed).toEqual([
      SPOTIFY_TOKEN,
      path.join(HOME, ".cache", "spotify-player", "credentials.json"),
    ]);
  });
});
