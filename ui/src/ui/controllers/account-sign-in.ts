// Control UI controller: signing in to Google and Spotify through Daisy's tools.
//
// The gateway runs the tool's own browser sign-in and keeps track of it; this
// starts it, installs the tool first when it is missing, follows it while the
// user is in the browser, and turns the skill on only once the gateway confirms
// the login was stored. A sign-in that fails, times out or is cancelled says so.
import { confirmDialog } from "../confirm-dialog.ts";
import type { SkillStatusEntry } from "../types.ts";
import type {
  AccountSignInStatus,
  SignInBusy,
  SignInJobView,
  SignInNotice,
  SignInService,
} from "../views/account-sign-in.ts";

export type AccountSignInStore = {
  status: AccountSignInStatus | null;
  loading: boolean;
  unsupported: boolean;
  busy: Partial<Record<SignInService, SignInBusy>>;
  notice: Partial<Record<SignInService, SignInNotice>>;
  googleEmail: string;
  replacingGoogleFile: boolean;
};

export const INITIAL_ACCOUNT_SIGN_IN: AccountSignInStore = {
  status: null,
  loading: false,
  unsupported: false,
  busy: {},
  notice: {},
  googleEmail: "",
  replacingGoogleFile: false,
};

type RequestClient = {
  request<T = unknown>(method: string, params?: unknown, opts?: { timeoutMs?: number }): Promise<T>;
};

export type AccountSignInHost = {
  client: RequestClient | null;
  connected: boolean;
  hello?: { features?: { methods?: unknown } } | null;
  skillsReport?: { skills?: SkillStatusEntry[] } | null;
  accountSignIn: AccountSignInStore;
  requestUpdate?: () => void;
};

export type AccountSignInHooks = {
  /** Refreshes the skills list after a skill is switched on or off. */
  reloadSkills?: () => unknown;
};

const SKILL_KEYS: Record<SignInService, string> = { google: "gog", spotify: "spotify-player" };
const LABELS: Record<SignInService, string> = { google: "Google", spotify: "Spotify" };
const POLL_INTERVAL_MS = 2_000;
/** A little longer than the gateway's own 5-minute sign-in limit. */
const POLL_LIMIT_MS = 6 * 60_000;
const MAX_CLIENT_FILE_BYTES = 64 * 1024;
const UNKNOWN_METHOD_PATTERN = /unknown method|method not found|unsupported method|-32601/i;

// The latest hooks per host. A sign-in can be followed by a poll another call
// started (a status load that found it running); the hooks must still reach
// the moment it finishes.
const hooksByHost = new WeakMap<object, AccountSignInHooks>();

function rememberHooks(host: AccountSignInHost, hooks: AccountSignInHooks) {
  if (hooks.reloadSkills) {
    hooksByHost.set(host, hooks);
  }
}

function patch(host: AccountSignInHost, next: Partial<AccountSignInStore>) {
  // Reassigned, not mutated, so Lit sees the change.
  host.accountSignIn = { ...host.accountSignIn, ...next };
  host.requestUpdate?.();
}

function setBusy(host: AccountSignInHost, service: SignInService, busy: SignInBusy | null) {
  const next = { ...host.accountSignIn.busy };
  if (busy) {
    next[service] = busy;
  } else {
    delete next[service];
  }
  patch(host, { busy: next });
}

function setNotice(host: AccountSignInHost, service: SignInService, notice: SignInNotice | null) {
  const next = { ...host.accountSignIn.notice };
  if (notice) {
    next[service] = notice;
  } else {
    delete next[service];
  }
  patch(host, { notice: next });
}

function errorText(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return message.replace(/^GatewayRequestError:\s*/i, "").trim() || "Something went wrong.";
}

function gatewayOffersSignIn(host: AccountSignInHost): boolean {
  const methods = host.hello?.features?.methods;
  return !Array.isArray(methods) || methods.includes("connections.status");
}

export async function loadAccountSignIn(
  host: AccountSignInHost,
  hooks: AccountSignInHooks = {},
): Promise<void> {
  rememberHooks(host, hooks);
  if (!gatewayOffersSignIn(host)) {
    patch(host, { unsupported: true, loading: false });
    return;
  }
  if (!host.client || !host.connected) {
    return;
  }
  patch(host, { loading: true });
  try {
    const status = await host.client.request<AccountSignInStatus>("connections.status", {});
    patch(host, { status, loading: false, unsupported: false });
    if (Object.values(status.jobs ?? {}).some((job) => job?.state === "running")) {
      ensurePolling(host);
    }
  } catch (err) {
    patch(host, {
      loading: false,
      ...(UNKNOWN_METHOD_PATTERN.test(errorText(err)) ? { unsupported: true } : {}),
    });
  }
}

/** Installs the tool behind the account when it is missing. Returns whether it is there now. */
async function ensureToolInstalled(
  host: AccountSignInHost,
  service: SignInService,
): Promise<boolean> {
  if (host.accountSignIn.status?.[service].installed) {
    return true;
  }
  const client = host.client;
  const skill = host.skillsReport?.skills?.find((entry) => entry.skillKey === SKILL_KEYS[service]);
  const option = skill?.install?.[0];
  if (!client || !skill || !option) {
    setNotice(host, service, {
      kind: "error",
      message: `The ${LABELS[service]} tool can't be installed automatically on this computer.`,
    });
    return false;
  }
  setBusy(host, service, "installing");
  try {
    await client.request(
      "skills.install",
      { name: skill.name, installId: option.id, timeoutMs: 120_000 },
      // Server-side install budget is 120s; keep the client timeout above it.
      { timeoutMs: 150_000 },
    );
  } catch (err) {
    setNotice(host, service, {
      kind: "error",
      message: `The ${LABELS[service]} tool could not be installed: ${errorText(err)}`,
    });
    return false;
  } finally {
    setBusy(host, service, null);
  }
  await loadAccountSignIn(host);
  if (host.accountSignIn.status?.[service].installed) {
    return true;
  }
  setNotice(host, service, {
    kind: "error",
    message: `The ${LABELS[service]} tool was downloaded but can't be found. Try again.`,
  });
  return false;
}

export async function saveGoogleClientFile(
  host: AccountSignInHost,
  file: { text: () => Promise<string>; size: number },
): Promise<void> {
  setNotice(host, "google", null);
  if (file.size > MAX_CLIENT_FILE_BYTES) {
    setNotice(host, "google", {
      kind: "error",
      message: "That file is too large to be a Google sign-in file.",
    });
    return;
  }
  const credentialsJson = await file.text();
  if (!(await ensureToolInstalled(host, "google")) || !host.client) {
    return;
  }
  setBusy(host, "google", "saving-file");
  try {
    await host.client.request("connections.google.setClient", { credentialsJson });
    patch(host, { replacingGoogleFile: false });
    setNotice(host, "google", {
      kind: "success",
      message: "Sign-in file saved. Now enter your Google address and press Connect Google.",
    });
  } catch (err) {
    setNotice(host, "google", { kind: "error", message: errorText(err) });
  } finally {
    setBusy(host, "google", null);
  }
  await loadAccountSignIn(host);
}

export async function startAccountSignIn(
  host: AccountSignInHost,
  service: SignInService,
  hooks: AccountSignInHooks = {},
): Promise<void> {
  rememberHooks(host, hooks);
  setNotice(host, service, null);
  const email = host.accountSignIn.googleEmail.trim();
  if (service === "google" && !email) {
    setNotice(host, "google", { kind: "error", message: "Enter your Google address first." });
    return;
  }
  if (!(await ensureToolInstalled(host, service)) || !host.client) {
    return;
  }
  setBusy(host, service, "starting");
  try {
    const result = await host.client.request<{ job?: SignInJobView }>("connections.connect", {
      service,
      ...(service === "google" ? { email } : {}),
    });
    const status = host.accountSignIn.status;
    if (status && result?.job) {
      patch(host, { status: { ...status, jobs: { ...status.jobs, [service]: result.job } } });
    }
    ensurePolling(host);
  } catch (err) {
    setNotice(host, service, { kind: "error", message: errorText(err) });
  } finally {
    setBusy(host, service, null);
  }
}

type PollState = { timer: ReturnType<typeof setTimeout> | null; startedAt: number };

const polls = new WeakMap<object, PollState>();

function ensurePolling(host: AccountSignInHost) {
  const existing = polls.get(host);
  if (existing?.timer) {
    return;
  }
  const poll: PollState = { timer: null, startedAt: Date.now() };
  polls.set(host, poll);
  const tick = async () => {
    poll.timer = null;
    const client = host.client;
    const before = host.accountSignIn.status;
    if (!client || !host.connected || !before) {
      return;
    }
    let jobs: AccountSignInStatus["jobs"];
    try {
      jobs =
        (
          await client.request<{ jobs?: AccountSignInStatus["jobs"] }>("connections.status", {
            jobsOnly: true,
          })
        ).jobs ?? {};
    } catch {
      jobs = before.jobs;
    }
    const current = host.accountSignIn.status ?? before;
    patch(host, { status: { ...current, jobs } });
    for (const service of ["google", "spotify"] as const) {
      const was = before.jobs[service];
      const now = jobs[service];
      if (was?.state === "running" && now && now.state !== "running") {
        await handleSignInFinished(host, service, now, hooksByHost.get(host) ?? {});
      }
    }
    const stillRunning = Object.values(jobs).some((job) => job?.state === "running");
    if (stillRunning && Date.now() - poll.startedAt < POLL_LIMIT_MS) {
      poll.timer = setTimeout(() => void tick(), POLL_INTERVAL_MS);
    }
  };
  poll.timer = setTimeout(() => void tick(), POLL_INTERVAL_MS);
}

async function setSkillEnabled(host: AccountSignInHost, service: SignInService, enabled: boolean) {
  await host.client
    ?.request("skills.update", { skillKey: SKILL_KEYS[service], enabled })
    .catch(() => undefined);
}

async function handleSignInFinished(
  host: AccountSignInHost,
  service: SignInService,
  job: SignInJobView,
  hooks: AccountSignInHooks,
) {
  if (job.state === "succeeded") {
    await setSkillEnabled(host, service, true);
    await loadAccountSignIn(host);
    await hooks.reloadSkills?.();
    const email = host.accountSignIn.googleEmail.trim();
    setNotice(host, service, {
      kind: "success",
      message:
        service === "google"
          ? `Connected${email ? ` as ${email}` : ""}. Try asking Daisy "What's on my calendar today?"`
          : `Spotify connected. Try asking Daisy "What's playing?"`,
    });
    return;
  }
  setNotice(host, service, {
    kind: job.state === "cancelled" ? "info" : "error",
    message: job.message ?? "The sign-in did not finish.",
  });
}

export async function cancelAccountSignIn(
  host: AccountSignInHost,
  service: SignInService,
): Promise<void> {
  if (!host.client) {
    return;
  }
  setBusy(host, service, "cancelling");
  try {
    await host.client.request("connections.cancel", { service });
  } catch (err) {
    setNotice(host, service, { kind: "error", message: errorText(err) });
  } finally {
    setBusy(host, service, null);
  }
}

export async function disconnectAccountSignIn(
  host: AccountSignInHost,
  service: SignInService,
  email: string | undefined,
  hooks: AccountSignInHooks = {},
  confirm: typeof confirmDialog = confirmDialog,
): Promise<void> {
  rememberHooks(host, hooks);
  const client = host.client;
  if (!client) {
    return;
  }
  const accepted = await confirm({
    title: `Disconnect ${LABELS[service]}?`,
    message:
      service === "google"
        ? `Daisy will no longer be able to read or change ${email ?? "this account"}'s mail, calendar or files. You can connect again at any time.`
        : "Daisy will no longer be able to control your music. You can connect again at any time.",
    confirmLabel: "Disconnect",
  });
  if (!accepted) {
    return;
  }
  setBusy(host, service, "disconnecting");
  try {
    await client.request("connections.disconnect", {
      service,
      ...(email ? { email } : {}),
    });
  } catch (err) {
    setNotice(host, service, { kind: "error", message: errorText(err) });
    return;
  } finally {
    setBusy(host, service, null);
  }
  await loadAccountSignIn(host);
  const stillConnected =
    service === "google"
      ? (host.accountSignIn.status?.google.accounts.length ?? 0) > 0
      : host.accountSignIn.status?.spotify.connected === true;
  if (!stillConnected) {
    // A skill left on with nothing connected fails on first use.
    await setSkillEnabled(host, service, false);
    await hooks.reloadSkills?.();
  }
  setNotice(host, service, { kind: "info", message: `${LABELS[service]} disconnected.` });
}
