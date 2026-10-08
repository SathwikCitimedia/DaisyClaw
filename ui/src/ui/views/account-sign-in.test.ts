import { render } from "lit";
import { describe, expect, it, vi } from "vitest";
import {
  GOOGLE_SETUP_LINKS,
  renderGoogleSetupCard,
  renderGoogleSignInRow,
  renderSpotifySignInRow,
  type AccountSignInProps,
  type AccountSignInStatus,
  type SignInTileActions,
} from "./account-sign-in.ts";

function status(overrides: Partial<AccountSignInStatus> = {}): AccountSignInStatus {
  return {
    google: { installed: true, hasClient: false, accounts: [] },
    spotify: { installed: true, connected: false },
    jobs: {},
    ...overrides,
  };
}

function props(overrides: Partial<AccountSignInProps> = {}): AccountSignInProps {
  return {
    status: status(),
    loading: false,
    unsupported: false,
    busy: {},
    notice: {},
    googleEmail: "",
    replacingGoogleFile: false,
    onGoogleEmailChange: vi.fn(),
    onGoogleClientFile: vi.fn(),
    onReplaceGoogleFile: vi.fn(),
    onConnect: vi.fn(),
    onCancel: vi.fn(),
    onDisconnect: vi.fn(),
    onSetUpWithDaisy: vi.fn(),
    onCopyLink: vi.fn(),
    onRefresh: vi.fn(),
    ...overrides,
  };
}

function tileActions(overrides: Partial<SignInTileActions> = {}): SignInTileActions {
  return { onOpenGoogleSetup: vi.fn(), onConfirmDisconnect: vi.fn(), ...overrides };
}

function mount(template: unknown) {
  const host = document.createElement("div");
  render(template, host);
  return host;
}

const buttonByText = (host: HTMLElement, text: string) =>
  [...host.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
    button.textContent?.includes(text),
  );

describe("Google sign-in", () => {
  it("opens the setup card from the tile instead of filling the tile with steps", () => {
    const onOpenGoogleSetup = vi.fn();
    const host = mount(renderGoogleSignInRow(props(), tileActions({ onOpenGoogleSetup })));
    expect(host.querySelector("[data-google-steps]")).toBeNull();
    expect(host.querySelector(".qs-connection")?.getAttribute("data-status")).toBe("not-connected");
    buttonByText(host, "Connect")?.click();
    expect(onOpenGoogleSetup).toHaveBeenCalledTimes(1);
  });

  it("walks through making the user's own sign-in app, with the right console pages", () => {
    const host = mount(renderGoogleSetupCard(props()));
    const links = [...host.querySelectorAll<HTMLAnchorElement>("[data-google-steps] a")].map(
      (link) => link.href,
    );
    expect(links).toEqual([
      GOOGLE_SETUP_LINKS.createProject,
      GOOGLE_SETUP_LINKS.enableApis,
      GOOGLE_SETUP_LINKS.consentScreen,
      GOOGLE_SETUP_LINKS.createClient,
    ]);
    expect(host.querySelector("[data-google-client-file]")).not.toBeNull();
    // Nothing to sign in with until the file is saved.
    expect(host.querySelector<HTMLInputElement>("[data-google-email]")?.disabled).toBe(true);
    expect(buttonByText(host, "Connect Google")?.disabled).toBe(true);
    expect(host.textContent).toContain("Publish app");
  });

  it("asks for the address once the file is saved, and connects with it", () => {
    const onConnect = vi.fn();
    const host = mount(
      renderGoogleSetupCard(
        props({
          status: status({ google: { installed: true, hasClient: true, accounts: [] } }),
          googleEmail: "me@gmail.com",
          onConnect,
        }),
      ),
    );
    expect(host.textContent).toContain("Your sign-in file is saved.");
    expect(host.querySelector("[data-google-client-file]")).toBeNull();
    buttonByText(host, "Connect Google")?.click();
    expect(onConnect).toHaveBeenCalledWith("google");
  });

  // Before the status arrives, whether the file is saved is not known. The card
  // used to ask for the file anyway, to people who had already added it.
  it("does not ask for the file while it is still checking", () => {
    const host = mount(renderGoogleSetupCard(props({ status: null, loading: true })));
    expect(host.textContent).toContain("Checking for your sign-in file");
    expect(host.querySelector("[data-google-client-file]")).toBeNull();
  });

  it("lets the user back out of replacing a saved file", () => {
    const onKeepGoogleFile = vi.fn();
    const host = mount(
      renderGoogleSetupCard(
        props({
          status: status({ google: { installed: true, hasClient: true, accounts: [] } }),
          replacingGoogleFile: true,
          onKeepGoogleFile,
        }),
      ),
    );
    expect(host.querySelector("[data-google-client-file]")).not.toBeNull();
    buttonByText(host, "Keep the saved file")?.click();
    expect(onKeepGoogleFile).toHaveBeenCalled();
  });

  it("says where to finish while waiting, with a way out and the link", () => {
    const onCancel = vi.fn();
    const onCopyLink = vi.fn();
    const host = mount(
      renderGoogleSignInRow(
        props({
          status: status({
            google: { installed: true, hasClient: true, accounts: [] },
            jobs: { google: { state: "running", authUrl: "https://accounts.google.com/x" } },
          }),
          onCancel,
          onCopyLink,
        }),
        tileActions(),
      ),
    );
    expect(host.querySelector(".qs-connection")?.getAttribute("data-status")).toBe("waiting");
    expect(host.textContent).toContain("Finish signing in in your browser.");
    expect(host.textContent).toContain("Advanced, then Continue");
    buttonByText(host, "Copy sign-in link")?.click();
    expect(onCopyLink).toHaveBeenCalledWith("https://accounts.google.com/x");
    buttonByText(host, "Cancel")?.click();
    expect(onCancel).toHaveBeenCalledWith("google");
  });

  it("shows who is connected, and asks before disconnecting", () => {
    const onConfirmDisconnect = vi.fn();
    const onDisconnect = vi.fn();
    const host = mount(
      renderGoogleSignInRow(
        props({
          status: status({
            google: { installed: true, hasClient: true, accounts: ["me@gmail.com"] },
          }),
          onDisconnect,
        }),
        tileActions({ onConfirmDisconnect }),
      ),
    );
    expect(host.textContent).toContain("Connected as me@gmail.com");
    expect(host.querySelector("[data-google-steps]")).toBeNull();
    buttonByText(host, "Disconnect")?.click();
    expect(onConfirmDisconnect).toHaveBeenCalledWith("google", "me@gmail.com");
    expect(onDisconnect).not.toHaveBeenCalled();
  });

  // Google drops a saved sign-in after 7 days while the user's app is in
  // testing. The tile kept saying "Connected", and a scheduled email failed.
  it("says when Google ended a sign-in, and reconnects that account in one click", () => {
    const onGoogleEmailChange = vi.fn();
    const onConnect = vi.fn();
    const host = mount(
      renderGoogleSignInRow(
        props({
          status: status({
            google: {
              installed: true,
              hasClient: true,
              accounts: ["me@gmail.com"],
              expiredAccounts: ["me@gmail.com"],
            },
          }),
          onGoogleEmailChange,
          onConnect,
        }),
        tileActions(),
      ),
    );
    expect(host.textContent).toContain("Sign-in expired");
    expect(host.textContent).not.toContain("Connected as");
    expect(host.textContent).toContain("Publish app");
    buttonByText(host, "Reconnect")?.click();
    expect(onGoogleEmailChange).toHaveBeenCalledWith("me@gmail.com");
    expect(onConnect).toHaveBeenCalledWith("google");
  });

  it("keeps showing a working sign-in as connected", () => {
    const host = mount(
      renderGoogleSignInRow(
        props({
          status: status({
            google: {
              installed: true,
              hasClient: true,
              accounts: ["me@gmail.com"],
              expiredAccounts: [],
            },
          }),
        }),
        tileActions(),
      ),
    );
    expect(host.textContent).toContain("Connected as me@gmail.com");
    expect(buttonByText(host, "Reconnect")).toBeUndefined();
  });

  it("offers Daisy's help, and says plainly when the check failed or the engine is older", () => {
    const onSetUpWithDaisy = vi.fn();
    const host = mount(renderGoogleSetupCard(props({ onSetUpWithDaisy })));
    buttonByText(host, "Set it up with Daisy")?.click();
    expect(onSetUpWithDaisy).toHaveBeenCalledWith("google");

    const failed = mount(renderGoogleSignInRow(props({ status: null }), tileActions()));
    expect(failed.textContent).toContain("Couldn't check this right now.");

    const old = mount(renderGoogleSignInRow(props({ unsupported: true }), tileActions()));
    expect(old.textContent).toContain("Update Daisy to connect Google from here.");
  });
});

describe("Spotify sign-in", () => {
  it("connects in one click and says Premium is needed", () => {
    const onConnect = vi.fn();
    const host = mount(renderSpotifySignInRow(props({ onConnect }), tileActions()));
    expect(host.textContent).toContain("Needs Spotify Premium");
    buttonByText(host, "Connect")?.click();
    expect(onConnect).toHaveBeenCalledWith("spotify");
  });

  it("warns it may ask twice while waiting, and asks before disconnecting once connected", () => {
    const waiting = mount(
      renderSpotifySignInRow(
        props({ status: status({ jobs: { spotify: { state: "running" } } }) }),
        tileActions(),
      ),
    );
    expect(waiting.textContent).toContain("Spotify may ask twice");

    const onConfirmDisconnect = vi.fn();
    const connected = mount(
      renderSpotifySignInRow(
        props({ status: status({ spotify: { installed: true, connected: true } }) }),
        tileActions({ onConfirmDisconnect }),
      ),
    );
    expect(connected.querySelector(".qs-connection")?.getAttribute("data-status")).toBe(
      "connected",
    );
    buttonByText(connected, "Disconnect")?.click();
    expect(onConfirmDisconnect).toHaveBeenCalledWith("spotify", undefined);
  });
});
