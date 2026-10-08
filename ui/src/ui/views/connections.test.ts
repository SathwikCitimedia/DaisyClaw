import { render } from "lit";
import { describe, expect, it, vi } from "vitest";
import {
  connectAccount,
  disconnectAccount,
  type ConnectionsState,
} from "../controllers/connections.ts";
import type { SkillStatusEntry } from "../types.ts";
import {
  CONNECTIONS,
  humanizeEnvName,
  humanizeSkillName,
  renderConnectionsCard,
  resolveConnectionDefinitions,
  resolveConnectionStatus,
  type ConnectionsProps,
} from "./connections.ts";

function skill(
  skillKey: string,
  overrides: Partial<SkillStatusEntry> & { missingEnv?: string[]; requiredEnv?: string[] } = {},
): SkillStatusEntry {
  const { missingEnv = [], requiredEnv = [], ...rest } = overrides;
  return {
    skillKey,
    name: skillKey,
    description: "",
    disabled: false,
    eligible: true,
    blockedByAllowlist: false,
    requirements: { env: requiredEnv, bins: [], config: [], os: [] },
    missing: { env: missingEnv, bins: [], config: [], os: [] },
    ...rest,
  } as unknown as SkillStatusEntry;
}

function definition(skillKey: string) {
  const found = CONNECTIONS.find((entry) => entry.skillKey === skillKey);
  if (!found) {
    throw new Error(`no connection defined for ${skillKey}`);
  }
  return found;
}

const notionSkill = (overrides: Partial<SkillStatusEntry> = {}) =>
  skill("notion", { primaryEnv: "NOTION_API_TOKEN", ...overrides });
const trelloSkill = (missingEnv: string[] = []) =>
  skill("trello", { requiredEnv: ["TRELLO_API_KEY", "TRELLO_TOKEN"], missingEnv });

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

  // Notion can fall back to its own CLI, so its token is not listed as
  // required and nothing ever showed as missing: it read "Connected" with no
  // token saved anywhere.
  it("does not call Notion connected while no token is saved", () => {
    expect(resolveConnectionStatus(definition("notion"), notionSkill())).toBe("not-connected");
    expect(
      resolveConnectionStatus(definition("notion"), notionSkill({ primaryEnvSatisfied: false })),
    ).toBe("not-connected");
  });

  it("calls Notion connected once its token is set and the skill is on", () => {
    expect(
      resolveConnectionStatus(definition("notion"), notionSkill({ primaryEnvSatisfied: true })),
    ).toBe("connected");
    expect(
      resolveConnectionStatus(
        definition("notion"),
        notionSkill({ primaryEnvSatisfied: true, disabled: true }),
      ),
    ).toBe("not-connected");
  });

  it("needs both Trello values before it counts as connected", () => {
    expect(resolveConnectionStatus(definition("trello"), trelloSkill(["TRELLO_TOKEN"]))).toBe(
      "not-connected",
    );
    expect(resolveConnectionStatus(definition("trello"), trelloSkill())).toBe("connected");
  });

  it("signs Google and Spotify in through the browser, connected only once switched on", () => {
    for (const key of ["gog", "spotify-player"]) {
      expect(definition(key).signIn).toBeTruthy();
      expect(definition(key).fields).toHaveLength(0);
      expect(definition(key).unavailableNote).toBeUndefined();
      expect(resolveConnectionStatus(definition(key), skill(key, { disabled: true }))).toBe(
        "not-connected",
      );
      expect(resolveConnectionStatus(definition(key), skill(key))).toBe("connected");
    }
  });

  it("gives Notion and Trello the steps and the page the values come from", () => {
    for (const key of ["notion", "trello"]) {
      expect(definition(key).steps?.length).toBeGreaterThan(1);
      expect(definition(key).link?.href).toMatch(/^https:\/\//);
    }
  });
});

describe("skills added later", () => {
  it("lists an installed skill that needs a key of its own, with plain names", () => {
    const definitions = resolveConnectionDefinitions([
      skill("gh-issues", {
        name: "gh-issues",
        description: "Work with GitHub issues. Opens and comments.",
        primaryEnv: "GH_TOKEN",
        bundled: true,
      }),
    ]);
    const github = definitions.find((entry) => entry.skillKey === "gh-issues");

    expect(github).toMatchObject({
      label: "GitHub",
      blurb: "Work with GitHub issues.",
      fields: [{ env: "GH_TOKEN", label: "GitHub token" }],
      discovered: true,
    });
  });

  it("keeps switched-off built-in extras, blocked skills and folder settings out", () => {
    const keys = resolveConnectionDefinitions([
      skill("sag", { requiredEnv: ["ELEVENLABS_API_KEY"], disabled: true, bundled: true }),
      skill("blocked", { requiredEnv: ["BLOCKED_API_KEY"], blockedByAllowlist: true }),
      skill("sherpa-onnx-tts", { requiredEnv: ["SHERPA_ONNX_MODEL_DIR"] }),
      skill("weather"),
    ]).map((entry) => entry.skillKey);

    expect(keys.toSorted()).toEqual(["gog", "notion", "spotify-player", "trello"]);
  });

  it("always lists a skill the user added, and never drops one already shown", () => {
    const added = skill("my-crm", {
      requiredEnv: ["MY_CRM_API_KEY"],
      disabled: true,
      bundled: false,
    });
    const builtInOff = skill("sag", {
      requiredEnv: ["ELEVENLABS_API_KEY"],
      disabled: true,
      bundled: true,
    });

    const keys = resolveConnectionDefinitions([added, builtInOff], new Set(["sag"])).map(
      (entry) => entry.skillKey,
    );

    expect(keys).toContain("my-crm");
    expect(keys).toContain("sag");
  });

  it("names keys and skills the way people say them", () => {
    expect(humanizeEnvName("ELEVENLABS_API_KEY")).toBe("ElevenLabs API key");
    expect(humanizeEnvName("GOOGLE_PLACES_API_KEY")).toBe("Google Places API key");
    expect(humanizeSkillName("openai-whisper-api")).toBe("OpenAI Whisper API");
  });
});

function cardProps(overrides: Partial<ConnectionsProps> = {}): ConnectionsProps {
  return {
    skills: [notionSkill(), trelloSkill(["TRELLO_API_KEY", "TRELLO_TOKEN"])],
    drafts: {},
    onDraftChange: vi.fn(),
    onDialogChange: vi.fn(),
    onConnect: vi.fn(),
    onDisconnect: vi.fn(),
    ...overrides,
  };
}

function mount(props: ConnectionsProps) {
  const host = document.createElement("div");
  render(renderConnectionsCard(props), host);
  return host;
}

const tile = (host: HTMLElement, key: string) =>
  host.querySelector<HTMLElement>(`.qs-connection[data-connection="${key}"]`);

describe("Connections card", () => {
  it("shows a Connect button instead of boxes on each tile", () => {
    const onDialogChange = vi.fn();
    const host = mount(cardProps({ onDialogChange }));

    expect(host.querySelector("input")).toBeNull();
    expect(tile(host, "notion")?.dataset.status).toBe("not-connected");
    tile(host, "trello")
      ?.querySelector<HTMLButtonElement>(".qs-connection__action button")
      ?.click();

    expect(onDialogChange).toHaveBeenCalledWith({ skillKey: "trello", mode: "connect" });
  });

  it("opens a card with the steps and both boxes, connecting only when both are filled", () => {
    const onConnect = vi.fn();
    const empty = mount(cardProps({ dialog: { skillKey: "trello", mode: "connect" }, onConnect }));
    const card = empty.querySelector('[data-connect-dialog="trello"]')!;

    expect(card.querySelectorAll("input[type=password]")).toHaveLength(2);
    expect(card.querySelector<HTMLAnchorElement>(".qs-connect-dialog__link")?.href).toBe(
      "https://trello.com/app-key",
    );
    expect(card.querySelector<HTMLButtonElement>("button[type=submit]")?.disabled).toBe(true);

    const filled = mount(
      cardProps({
        dialog: { skillKey: "trello", mode: "connect" },
        drafts: { TRELLO_API_KEY: "key", TRELLO_TOKEN: "token" },
        onConnect,
      }),
    );
    filled.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));

    expect(onConnect).toHaveBeenCalledWith(expect.objectContaining({ skillKey: "trello" }));
  });

  it("shows why a key was refused inside the card, not on the tile", () => {
    const host = mount(
      cardProps({
        dialog: { skillKey: "notion", mode: "connect" },
        notice: { skillKey: "notion", kind: "error", message: "Notion didn't accept this token." },
      }),
    );

    expect(host.querySelector('[data-connect-dialog="notion"]')?.textContent).toContain(
      "Notion didn't accept this token.",
    );
    expect(tile(host, "notion")?.querySelector(".qs-connection__notice")).toBeNull();
  });

  it("offers Disconnect on a connected tile, and asks before disconnecting", () => {
    const onDialogChange = vi.fn();
    const onDisconnect = vi.fn();
    const connected = cardProps({
      skills: [notionSkill({ primaryEnvSatisfied: true })],
      onDialogChange,
      onDisconnect,
    });
    const host = mount(connected);
    const button = tile(host, "notion")?.querySelector<HTMLButtonElement>(
      ".qs-connection__action button",
    );

    expect(button?.textContent?.trim()).toBe("Disconnect");
    button?.click();
    expect(onDialogChange).toHaveBeenCalledWith({ skillKey: "notion", mode: "disconnect" });
    expect(onDisconnect).not.toHaveBeenCalled();

    const asking = mount({ ...connected, dialog: { skillKey: "notion", mode: "disconnect" } });
    asking.querySelector<HTMLButtonElement>(".qs-connect-dialog .btn.danger")?.click();
    expect(onDisconnect).toHaveBeenCalledWith(expect.objectContaining({ skillKey: "notion" }));
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
      connectionDialog: { skillKey: "notion", mode: "connect" },
    };
  }

  const answering = (check: unknown) =>
    vi.fn(async (method: string) => (method === "connections.checkKeys" ? check : { ok: true }));

  it("checks the value, saves it, switches the skill on and closes the card", async () => {
    const request = answering({ status: "valid" });
    const state = makeState(request);
    state.connectionDrafts.NOTION_API_TOKEN = "ntn_secret";

    const ok = await connectAccount(state, definition("notion"));

    expect(ok).toBe(true);
    expect(request).toHaveBeenCalledWith("connections.checkKeys", {
      skillKey: "notion",
      env: { NOTION_API_TOKEN: "ntn_secret" },
    });
    expect(request).toHaveBeenCalledWith("skills.update", {
      skillKey: "notion",
      env: { NOTION_API_TOKEN: "ntn_secret" },
    });
    expect(request).toHaveBeenCalledWith("skills.update", { skillKey: "notion", enabled: true });
    // The typed secret does not linger in view state.
    expect(state.connectionDrafts.NOTION_API_TOKEN).toBeUndefined();
    expect(state.connectionDialog).toBeNull();
    expect(state.connectionNotice?.kind).toBe("success");
  });

  it("keeps the card open with the service's reason when the key is refused", async () => {
    const request = answering({ status: "invalid", message: "Notion didn't accept this token." });
    const state = makeState(request);
    state.connectionDrafts.NOTION_API_TOKEN = "wrong";

    const ok = await connectAccount(state, definition("notion"));

    expect(ok).toBe(false);
    expect(request).not.toHaveBeenCalledWith("skills.update", expect.anything());
    expect(state.connectionDialog).toEqual({ skillKey: "notion", mode: "connect" });
    expect(state.connectionDrafts.NOTION_API_TOKEN).toBe("wrong");
    expect(state.connectionNotice).toEqual({
      skillKey: "notion",
      kind: "error",
      message: "Notion didn't accept this token.",
    });
  });

  it("still connects when the engine is older than the check", async () => {
    const request = vi.fn(async (method: string) => {
      if (method === "connections.checkKeys") {
        throw new Error("unknown method: connections.checkKeys");
      }
      return { ok: true };
    });
    const state = makeState(request);
    state.connectionDrafts.NOTION_API_TOKEN = "ntn_secret";

    await expect(connectAccount(state, definition("notion"))).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith("skills.update", { skillKey: "notion", enabled: true });
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
    const request = vi.fn(async (method: string) => {
      if (method === "connections.checkKeys") {
        return { status: "valid" };
      }
      throw new Error("config locked");
    });
    const state = makeState(request);
    state.connectionDrafts.NOTION_API_TOKEN = "ntn_secret";

    const ok = await connectAccount(state, definition("notion"));

    expect(ok).toBe(false);
    expect(state.connectionNotice?.kind).toBe("error");
    expect(state.connectionBusyKey).toBeNull();
  });

  it("disconnects by removing the saved values and switching the skill off", async () => {
    const request = vi.fn(async () => ({ ok: true }));
    const state = makeState(request);
    state.connectionDialog = { skillKey: "trello", mode: "disconnect" };

    const ok = await disconnectAccount(state, definition("trello"));

    expect(ok).toBe(true);
    expect(request).toHaveBeenCalledWith("skills.update", {
      skillKey: "trello",
      env: { TRELLO_API_KEY: "", TRELLO_TOKEN: "" },
      apiKey: "",
      enabled: false,
    });
    expect(state.connectionDialog).toBeNull();
    expect(state.connectionNotice).toMatchObject({ kind: "success" });
  });
});
