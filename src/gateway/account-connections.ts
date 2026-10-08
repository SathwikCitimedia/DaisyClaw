// Connects the accounts Daisy reaches through her own tools: Google through
// `gog` and Spotify through `spotify_player`.
//
// Both tools already run a proper browser sign-in on this computer (they open
// the user's browser, catch the redirect on a loopback port, and store the
// login themselves), but only from a terminal. This runs that same sign-in for
// the Settings screen, keeps track of it while the user is in the browser, and
// reports honestly when it finishes, fails, times out, or is cancelled.
//
// Google uses the user's own Google Cloud sign-in app (their "client" JSON),
// which suits an assistant that runs on the user's own computer: the login is
// theirs, and nothing passes through anyone else's app.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolveExecutableFromPathEnv } from "../infra/executable-path.js";
import { collectSkillToolPathDirs } from "../skills/runtime/tool-bins.js";

export type ConnectableService = "google" | "spotify";

export type ConnectionJobState = "running" | "succeeded" | "failed" | "cancelled";

export type ConnectionJobView = {
  state: ConnectionJobState;
  startedAt: number;
  finishedAt?: number;
  /** Why it failed, in words a person can act on. */
  message?: string;
  /** The sign-in page, for when the browser did not open by itself. */
  authUrl?: string;
};

export type AccountConnectionsStatus = {
  google: {
    installed: boolean;
    hasClient: boolean;
    accounts: string[];
    /** Saved accounts whose sign-in Google no longer accepts; they need signing in again. */
    expiredAccounts: string[];
  };
  spotify: { installed: boolean; connected: boolean };
  jobs: Partial<Record<ConnectableService, ConnectionJobView>>;
};

/** Everything the Google skill can do: mail, calendar, files, contacts, documents, sheets. */
export const GOOGLE_SIGN_IN_SERVICES = "gmail,calendar,drive,contacts,docs,sheets";
/** How long the user has to finish in the browser. */
export const CONNECT_TIMEOUT_MS = 5 * 60_000;
const QUICK_COMMAND_TIMEOUT_MS = 30_000;
const MAX_CLIENT_FILE_BYTES = 64 * 1024;
const MAX_CAPTURED_OUTPUT_CHARS = 64 * 1024;
const SPOTIFY_TOKEN_FILES = ["user_client_token.json", "credentials.json"] as const;
const AUTH_URL_PATTERN = /https:\/\/accounts\.(?:google|spotify)\.com\/[^\s"'<>]+/;

export class AccountConnectionError extends Error {
  constructor(
    message: string,
    readonly code: "not_installed" | "invalid_request" | "busy" | "failed",
  ) {
    super(message);
    this.name = "AccountConnectionError";
  }
}

export type RunResult = {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  aborted: boolean;
};

export type RunOptions = {
  timeoutMs: number;
  signal?: AbortSignal;
  onOutput?: (chunk: string) => void;
};

export type AccountConnectionDeps = {
  findBinary: (bin: string) => string | null;
  run: (command: string, args: readonly string[], opts: RunOptions) => Promise<RunResult>;
  fileExists: (filePath: string) => Promise<boolean>;
  writePrivateFile: (filePath: string, contents: string) => Promise<void>;
  removeFile: (filePath: string) => Promise<void>;
  homeDir: () => string;
  tmpDir: () => string;
  now: () => number;
};

/** The same PATH the agent's exec tool sees: downloaded skill tools first, then the system PATH. */
function findBinaryOnSkillPath(bin: string): string | null {
  const systemPath = process.env.PATH ?? process.env.Path ?? "";
  const searchPath = [...collectSkillToolPathDirs(), systemPath]
    .filter(Boolean)
    .join(process.platform === "win32" ? ";" : path.delimiter);
  return resolveExecutableFromPathEnv(bin, searchPath) ?? null;
}

function runProcess(
  command: string,
  args: readonly string[],
  opts: RunOptions,
): Promise<RunResult> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let aborted = false;
    let settled = false;
    const child = spawn(command, [...args], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: false,
    });
    const capture = (current: string, chunk: string) =>
      (current + chunk).slice(-MAX_CAPTURED_OUTPUT_CHARS);
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout = capture(stdout, chunk);
      opts.onOutput?.(chunk);
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr = capture(stderr, chunk);
      opts.onOutput?.(chunk);
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, opts.timeoutMs);
    const onAbort = () => {
      aborted = true;
      child.kill();
    };
    opts.signal?.addEventListener("abort", onAbort, { once: true });
    const finish = (code: number | null) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
      resolve({ code, stdout, stderr, timedOut, aborted });
    };
    child.on("error", (err) => {
      stderr = capture(stderr, err.message);
      finish(null);
    });
    child.on("close", (code) => finish(code));
  });
}

export const defaultAccountConnectionDeps: AccountConnectionDeps = {
  findBinary: findBinaryOnSkillPath,
  run: runProcess,
  fileExists: async (filePath) => {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  },
  writePrivateFile: async (filePath, contents) => {
    await fs.writeFile(filePath, contents, { encoding: "utf8", mode: 0o600 });
  },
  removeFile: async (filePath) => {
    await fs.rm(filePath, { force: true });
  },
  homeDir: () => os.homedir(),
  tmpDir: () => os.tmpdir(),
  now: () => Date.now(),
};

type Job = { view: ConnectionJobView; abort: AbortController };

const jobs = new Map<ConnectableService, Job>();

/** For tests: forget every job. */
export function resetAccountConnectionJobsForTest() {
  for (const job of jobs.values()) {
    job.abort.abort();
  }
  jobs.clear();
}

function jobViews(): Partial<Record<ConnectableService, ConnectionJobView>> {
  const views: Partial<Record<ConnectableService, ConnectionJobView>> = {};
  for (const [service, job] of jobs) {
    views[service] = { ...job.view };
  }
  return views;
}

function spotifyCacheDir(deps: AccountConnectionDeps): string {
  // spotify_player's default cache folder, the same on every platform.
  return path.join(deps.homeDir(), ".cache", "spotify-player");
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Google turned the saved sign-in down for good: revoked, or expired. That is
 * what happens every 7 days while the user's Google app is still in "Testing".
 * A network failure is not this; being offline must not look like a sign-out.
 */
const GOOGLE_SIGN_IN_REJECTED = /invalid_grant|invalid_client|unauthorized_client|revoked|expired/i;

type GoogleAccountEntry = { email?: unknown; valid?: unknown; error?: unknown };

function readGoogleAccounts(stdout: string): GoogleAccountEntry[] | null {
  const accounts = (parseJson(stdout) as { accounts?: unknown[] } | null)?.accounts;
  return Array.isArray(accounts) ? (accounts as GoogleAccountEntry[]) : null;
}

async function readGoogleState(
  deps: AccountConnectionDeps,
  gog: string,
): Promise<{ hasClient: boolean; accounts: string[]; expiredAccounts: string[] }> {
  // `--check` asks Google whether each saved sign-in still works. Without it,
  // a sign-in Google had already rejected still showed as "Connected", and the
  // first sign of trouble was a scheduled email that never went out.
  const [clientsRun, checkedRun] = await Promise.all([
    deps.run(gog, ["auth", "credentials", "list", "--json", "--no-input"], {
      timeoutMs: QUICK_COMMAND_TIMEOUT_MS,
    }),
    deps.run(gog, ["auth", "list", "--check", "--json", "--no-input"], {
      timeoutMs: QUICK_COMMAND_TIMEOUT_MS,
    }),
  ]);
  let entries = readGoogleAccounts(checkedRun.stdout);
  if (!entries) {
    // A gog too old for --check, or a check that failed outright: fall back
    // to the plain list rather than show no account at all.
    const plainRun = await deps.run(gog, ["auth", "list", "--json", "--no-input"], {
      timeoutMs: QUICK_COMMAND_TIMEOUT_MS,
    });
    entries = readGoogleAccounts(plainRun.stdout) ?? [];
  }
  const clients = (parseJson(clientsRun.stdout) as { clients?: unknown[] } | null)?.clients;
  const accounts: string[] = [];
  const expiredAccounts: string[] = [];
  for (const entry of entries) {
    const email = typeof entry?.email === "string" ? entry.email : "";
    if (!email) {
      continue;
    }
    accounts.push(email);
    if (
      entry.valid === false &&
      typeof entry.error === "string" &&
      GOOGLE_SIGN_IN_REJECTED.test(entry.error)
    ) {
      expiredAccounts.push(email);
    }
  }
  return {
    hasClient: Array.isArray(clients) && clients.length > 0,
    accounts,
    expiredAccounts,
  };
}

async function isSpotifyConnected(deps: AccountConnectionDeps): Promise<boolean> {
  return deps.fileExists(path.join(spotifyCacheDir(deps), "user_client_token.json"));
}

export async function getAccountConnectionsStatus(
  deps: AccountConnectionDeps = defaultAccountConnectionDeps,
): Promise<AccountConnectionsStatus> {
  const gog = deps.findBinary("gog");
  const spotify = deps.findBinary("spotify_player");
  const google = gog
    ? await readGoogleState(deps, gog)
    : { hasClient: false, accounts: [], expiredAccounts: [] };
  return {
    google: { installed: Boolean(gog), ...google },
    spotify: {
      installed: Boolean(spotify),
      connected: spotify ? await isSpotifyConnected(deps) : false,
    },
    jobs: jobViews(),
  };
}

/** Only the in-flight sign-ins; cheap enough to ask for every couple of seconds. */
export function getAccountConnectionJobs(): Partial<Record<ConnectableService, ConnectionJobView>> {
  return jobViews();
}

/**
 * Checks the file the user downloaded from Google before handing it to gog, so
 * a wrong file gets a reason they can act on instead of a tool error.
 */
export function validateGoogleClientFile(text: string): void {
  if (text.length > MAX_CLIENT_FILE_BYTES) {
    throw new AccountConnectionError(
      "That file is too large to be a Google sign-in file.",
      "invalid_request",
    );
  }
  const parsed = parseJson(text) as Record<string, unknown> | null;
  if (!parsed || typeof parsed !== "object") {
    throw new AccountConnectionError(
      "That file is not the one Google gives you. Download the JSON file for your OAuth client and try again.",
      "invalid_request",
    );
  }
  if (parsed.web && !parsed.installed) {
    throw new AccountConnectionError(
      'That file is for a "Web application" client. Create a client of type "Desktop app" instead, then download its file.',
      "invalid_request",
    );
  }
  const installed = parsed.installed as Record<string, unknown> | undefined;
  if (
    !installed ||
    typeof installed.client_id !== "string" ||
    typeof installed.client_secret !== "string" ||
    !installed.client_id ||
    !installed.client_secret
  ) {
    throw new AccountConnectionError(
      'That file is not a Google "Desktop app" sign-in file. Download the JSON file for your Desktop app client and try again.',
      "invalid_request",
    );
  }
}

/** Last useful line a tool printed, for a failure message. */
function describeToolFailure(result: RunResult, fallback: string): string {
  const lines = `${result.stderr}\n${result.stdout}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !AUTH_URL_PATTERN.test(line));
  const last = lines.at(-1);
  return last ? last.slice(0, 300) : fallback;
}

function requireBinary(deps: AccountConnectionDeps, service: ConnectableService): string {
  const bin = deps.findBinary(service === "google" ? "gog" : "spotify_player");
  if (!bin) {
    throw new AccountConnectionError(
      service === "google"
        ? "The Google tool is not installed yet."
        : "The Spotify tool is not installed yet.",
      "not_installed",
    );
  }
  return bin;
}

export async function setGoogleClient(
  credentialsJson: string,
  deps: AccountConnectionDeps = defaultAccountConnectionDeps,
): Promise<void> {
  validateGoogleClientFile(credentialsJson);
  const gog = requireBinary(deps, "google");
  // gog copies the file into its own config (and the secret into the system
  // keyring), so the copy written here only lives for the length of the call.
  const tempFile = path.join(deps.tmpDir(), `daisy-google-client-${randomUUID()}.json`);
  try {
    await deps.writePrivateFile(tempFile, credentialsJson);
    const result = await deps.run(gog, ["auth", "credentials", "set", tempFile, "--no-input"], {
      timeoutMs: QUICK_COMMAND_TIMEOUT_MS,
    });
    if (result.code !== 0) {
      throw new AccountConnectionError(
        `Google's sign-in file could not be saved: ${describeToolFailure(result, "the tool did not say why")}`,
        "failed",
      );
    }
  } finally {
    await deps.removeFile(tempFile).catch(() => undefined);
  }
}

const EMAIL_PATTERN = /^[^\s@"'<>]+@[^\s@"'<>]+\.[^\s@"'<>]+$/;

function normalizeGoogleEmail(email: string | undefined): string {
  const value = (email ?? "").trim();
  // A leading dash would be read as a flag by the tool.
  if (!value || value.length > 254 || value.startsWith("-") || !EMAIL_PATTERN.test(value)) {
    throw new AccountConnectionError(
      "Enter the Google address you want to connect, like name@gmail.com.",
      "invalid_request",
    );
  }
  return value;
}

/**
 * Starts a sign-in and returns at once; the user finishes it in the browser.
 * Progress is read back through the job view.
 */
export async function startAccountConnect(
  params: { service: ConnectableService; email?: string },
  deps: AccountConnectionDeps = defaultAccountConnectionDeps,
): Promise<ConnectionJobView> {
  if (jobs.get(params.service)?.view.state === "running") {
    throw new AccountConnectionError(
      "A sign-in is already waiting in your browser. Finish it there, or cancel it first.",
      "busy",
    );
  }
  const bin = requireBinary(deps, params.service);
  let args: string[];
  if (params.service === "google") {
    const email = normalizeGoogleEmail(params.email);
    const { hasClient } = await readGoogleState(deps, bin);
    if (!hasClient) {
      throw new AccountConnectionError(
        "Add your Google sign-in file first (step 4 above).",
        "invalid_request",
      );
    }
    args = [
      "auth",
      "add",
      email,
      "--services",
      GOOGLE_SIGN_IN_SERVICES,
      // Ask for consent every time so Google hands over a lasting sign-in, not a one-hour one.
      "--force-consent",
      // There is no one at a terminal to answer a question: never ask one,
      // and skip the "replace the existing login?" confirmation on a reconnect.
      "--no-input",
      "--force",
    ];
  } else {
    args = ["authenticate"];
  }

  const abort = new AbortController();
  const view: ConnectionJobView = { state: "running", startedAt: deps.now() };
  jobs.set(params.service, { view, abort });

  void deps
    .run(bin, args, {
      timeoutMs: CONNECT_TIMEOUT_MS,
      signal: abort.signal,
      onOutput: (chunk) => {
        // The tools print the sign-in page too; keep the latest one so a
        // browser that did not open by itself can still be reached.
        const url = AUTH_URL_PATTERN.exec(chunk)?.[0];
        if (url) {
          view.authUrl = url;
        }
      },
    })
    .then(async (result) => {
      if (result.aborted) {
        finishJob(view, deps, "cancelled", "Sign-in cancelled.");
        return;
      }
      if (result.timedOut) {
        finishJob(
          view,
          deps,
          "failed",
          "The sign-in was not finished within 5 minutes. Start again when you are ready.",
        );
        return;
      }
      if (result.code !== 0) {
        finishJob(view, deps, "failed", describeToolFailure(result, "The sign-in did not finish."));
        return;
      }
      // Exit 0 is not proof: check that the login was really stored.
      const stored =
        params.service === "google"
          ? (await readGoogleState(deps, bin)).accounts.some(
              (account) => account.toLowerCase() === params.email?.trim().toLowerCase(),
            )
          : await isSpotifyConnected(deps);
      if (stored) {
        finishJob(view, deps, "succeeded");
        return;
      }
      finishJob(
        view,
        deps,
        "failed",
        "The sign-in finished, but no login was saved. Try connecting again.",
      );
    })
    .catch((err: unknown) => {
      finishJob(view, deps, "failed", err instanceof Error ? err.message : String(err));
    });

  return { ...view };
}

/** A job's outcome and its finish time land together, so no one reads one without the other. */
function finishJob(
  view: ConnectionJobView,
  deps: AccountConnectionDeps,
  state: Exclude<ConnectionJobState, "running">,
  message?: string,
) {
  view.state = state;
  view.finishedAt = deps.now();
  if (message) {
    view.message = message;
  }
}

export function cancelAccountConnect(service: ConnectableService): boolean {
  const job = jobs.get(service);
  if (!job || job.view.state !== "running") {
    return false;
  }
  job.abort.abort();
  return true;
}

export async function disconnectAccount(
  params: { service: ConnectableService; email?: string },
  deps: AccountConnectionDeps = defaultAccountConnectionDeps,
): Promise<void> {
  cancelAccountConnect(params.service);
  if (params.service === "spotify") {
    const dir = spotifyCacheDir(deps);
    for (const name of SPOTIFY_TOKEN_FILES) {
      await deps.removeFile(path.join(dir, name));
    }
    return;
  }
  const gog = requireBinary(deps, "google");
  const email = normalizeGoogleEmail(params.email);
  const result = await deps.run(gog, ["auth", "remove", email, "--force", "--no-input"], {
    timeoutMs: QUICK_COMMAND_TIMEOUT_MS,
  });
  if (result.code !== 0) {
    throw new AccountConnectionError(
      `Google could not be disconnected: ${describeToolFailure(result, "the tool did not say why")}`,
      "failed",
    );
  }
}
