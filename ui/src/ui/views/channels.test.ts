// Control UI tests cover channels behavior.
import { render } from "lit";
import { describe, expect, it, vi } from "vitest";
import type { WhatsAppStatus } from "../types.ts";
import { renderAllowedContactsSection } from "./channels.contacts.ts";
import { hasChannelSetupGuide, renderChannelSetup } from "./channels.setup.ts";
import {
  channelEnabled,
  resolveChannelConfigured,
  resolveChannelDisplayState,
} from "./channels.shared.ts";
import type { ChannelsProps } from "./channels.types.ts";
import { renderWhatsAppCard } from "./channels.whatsapp.ts";

function createProps(snapshot: ChannelsProps["snapshot"]): ChannelsProps {
  return {
    connected: true,
    loading: false,
    snapshot,
    lastError: null,
    lastSuccessAt: null,
    whatsappMessage: null,
    whatsappQrDataUrl: null,
    whatsappConnected: null,
    whatsappBusy: false,
    configSchema: null,
    configSchemaLoading: false,
    configForm: null,
    configUiHints: {},
    configSaving: false,
    configFormDirty: false,
    nostrProfileFormState: null,
    nostrProfileAccountId: null,
    contactsBusy: null,
    contactsError: null,
    pairingRequests: null,
    pairingBusy: null,
    onContactAdd: () => {},
    onContactsAdd: () => {},
    onContactRemove: async () => true,
    onContactRename: () => {},
    contactEditKey: null,
    onContactEditStart: () => {},
    onContactEditCancel: () => {},
    onDmPolicyChange: () => {},
    onPairingApprove: () => {},
    onPairingReject: () => {},
    onOpenChannel: () => {},
    onCloseChannel: () => {},
    onChannelSetupConnect: () => {},
    channelSetupBusy: null,
    onChannelDisconnect: () => {},
    channelDisconnectBusy: null,
    onChannelEnable: () => {},
    channelEnableBusy: null,
    setupForcedChannel: null,
    onForceSetup: () => {},
    onRefresh: () => {},
    onWhatsAppConnect: () => {},
    onWhatsAppLogout: () => {},
    onConfigPatch: () => {},
    onConfigSave: () => {},
    onConfigReload: () => {},
    onNostrProfileEdit: () => {},
    onNostrProfileCancel: () => {},
    onNostrProfileFieldChange: () => {},
    onNostrProfileSave: () => {},
    onNostrProfileImport: () => {},
    onNostrProfileToggleAdvanced: () => {},
  };
}

function createWhatsAppStatus(overrides: Partial<WhatsAppStatus> = {}): WhatsAppStatus {
  return {
    configured: true,
    linked: false,
    running: false,
    connected: false,
    reconnectAttempts: 0,
    ...overrides,
  };
}

function renderWhatsAppButtons(params: {
  linked?: boolean;
  qrDataUrl?: string | null;
  onWhatsAppConnect?: ChannelsProps["onWhatsAppConnect"];
}) {
  const whatsapp = createWhatsAppStatus({ linked: params.linked === true });
  const props = createProps({
    ts: Date.now(),
    channelOrder: ["whatsapp"],
    channelLabels: { whatsapp: "WhatsApp" },
    channels: { whatsapp },
    channelAccounts: {},
    channelDefaultAccountId: {},
  });
  props.whatsappQrDataUrl = params.qrDataUrl ?? null;
  if (params.onWhatsAppConnect) {
    props.onWhatsAppConnect = params.onWhatsAppConnect;
  }

  const container = document.createElement("div");
  render(renderWhatsAppCard({ props, whatsapp, accountCountLabel: null }), container);
  const buttons = Array.from(container.querySelectorAll("button"));
  return {
    buttons,
    labels: buttons.map((button) => button.textContent?.trim()),
  };
}

describe("channel display selectors", () => {
  it("returns the channel summary configured flag when present", () => {
    const props = createProps({
      ts: Date.now(),
      channelOrder: ["guildchat"],
      channelLabels: { guildchat: "Guild Chat" },
      channels: { guildchat: { configured: false } },
      channelAccounts: {
        guildchat: [{ accountId: "guild-main", configured: true }],
      },
      channelDefaultAccountId: { guildchat: "guild-main" },
    });

    expect(resolveChannelConfigured("guildchat", props)).toBe(false);
    expect(resolveChannelDisplayState("guildchat", props).configured).toBe(false);
  });

  it("falls back to the default account when the channel summary omits configured", () => {
    const props = createProps({
      ts: Date.now(),
      channelOrder: ["guildchat"],
      channelLabels: { guildchat: "Guild Chat" },
      channels: { guildchat: { running: true } },
      channelAccounts: {
        guildchat: [
          { accountId: "default", configured: false },
          { accountId: "guild-main", configured: true },
        ],
      },
      channelDefaultAccountId: { guildchat: "guild-main" },
    });

    const displayState = resolveChannelDisplayState("guildchat", props);

    expect(resolveChannelConfigured("guildchat", props)).toBe(true);
    expect(displayState.defaultAccount?.accountId).toBe("guild-main");
    expect(channelEnabled("guildchat", props)).toBe(true);
  });

  it("falls back to the first account when no default account id is available", () => {
    const props = createProps({
      ts: Date.now(),
      channelOrder: ["workspace"],
      channelLabels: { workspace: "Workspace" },
      channels: { workspace: { running: true } },
      channelAccounts: {
        workspace: [{ accountId: "workspace-a", configured: true }],
      },
      channelDefaultAccountId: {},
    });

    const displayState = resolveChannelDisplayState("workspace", props);

    expect(resolveChannelConfigured("workspace", props)).toBe(true);
    expect(displayState.defaultAccount?.accountId).toBe("workspace-a");
  });

  it("keeps disabled channels hidden when neither summary nor accounts are active", () => {
    const props = createProps({
      ts: Date.now(),
      channelOrder: ["quietchat"],
      channelLabels: { quietchat: "Quiet Chat" },
      channels: { quietchat: {} },
      channelAccounts: {
        quietchat: [
          {
            accountId: "default",
            configured: false,
            running: false,
            connected: false,
          },
        ],
      },
      channelDefaultAccountId: { quietchat: "default" },
    });

    const displayState = resolveChannelDisplayState("quietchat", props);

    expect(displayState.configured).toBe(false);
    expect(displayState.running).toBeNull();
    expect(displayState.connected).toBeNull();
    expect(channelEnabled("quietchat", props)).toBe(false);
  });
});

describe("WhatsApp card actions", () => {
  it("shows Connect as the single primary action before WhatsApp is linked", () => {
    const onWhatsAppConnect = vi.fn();
    const { buttons, labels } = renderWhatsAppButtons({
      linked: false,
      onWhatsAppConnect,
    });

    // Connect actions render above the config form so the QR appears next to
    // the button that generated it. Logout is hidden while nothing is linked.
    expect(labels).toEqual(["Connect", "Refresh", "Add", "Import…", "Save", "Reload"]);

    const connect = buttons.find((button) => button.textContent?.trim() === "Connect");
    expect(connect).toBeInstanceOf(HTMLButtonElement);
    connect!.click();
    expect(onWhatsAppConnect).toHaveBeenCalledWith(false);
  });

  it("uses relink as the explicit action after WhatsApp is linked", () => {
    const onWhatsAppConnect = vi.fn();
    const { buttons, labels } = renderWhatsAppButtons({
      linked: true,
      onWhatsAppConnect,
    });

    expect(labels).toEqual(["Relink", "Logout", "Refresh", "Add", "Import…", "Save", "Reload"]);

    const relink = buttons.find((button) => button.textContent?.trim() === "Relink");
    expect(relink).toBeInstanceOf(HTMLButtonElement);
    relink!.click();
    expect(onWhatsAppConnect).toHaveBeenCalledWith(true);
  });

  it("keeps a single action while a QR is displayed (no extra wait step)", () => {
    const { labels } = renderWhatsAppButtons({
      linked: false,
      qrDataUrl: "data:image/png;base64,current-qr",
    });

    expect(labels).toEqual(["Connect", "Refresh", "Add", "Import…", "Save", "Reload"]);
  });
});

describe("allowed contacts names", () => {
  function renderContacts(params: {
    channelId?: string;
    allowFrom?: string[];
    contactLabels?: Record<string, string>;
    contactEditKey?: string | null;
    overrides?: Partial<ChannelsProps>;
  }) {
    const channelId = params.channelId ?? "whatsapp";
    const props = createProps({
      ts: Date.now(),
      channelOrder: [channelId],
      channelLabels: { [channelId]: channelId },
      channels: {},
      channelAccounts: {},
      channelDefaultAccountId: {},
    });
    props.configForm = {
      channels: {
        [channelId]: {
          allowFrom: params.allowFrom ?? [],
          ...(params.contactLabels ? { contactLabels: params.contactLabels } : {}),
        },
      },
    };
    props.contactEditKey = params.contactEditKey ?? null;
    Object.assign(props, params.overrides);

    const container = document.createElement("div");
    render(renderAllowedContactsSection({ channelId, props }), container);
    return container;
  }

  it("shows the saved name with the number underneath it", () => {
    const container = renderContacts({
      allowFrom: ["+111", "+222"],
      contactLabels: { "+111": "Aasrith" },
    });

    const rows = Array.from(container.querySelectorAll(".contacts-list__row"));
    expect(rows).toHaveLength(2);
    expect(rows[0]?.querySelector(".contacts-list__name")?.textContent?.trim()).toBe("Aasrith");
    expect(rows[0]?.querySelector(".contacts-list__value")?.textContent?.trim()).toBe("+111");
    // Unnamed contacts get an explicit "Add name" affordance instead of a bare pencil.
    expect(rows[1]?.querySelector(".contacts-list__name")).toBeNull();
    expect(rows[1]?.querySelector(".contacts-list__addname")?.textContent?.trim()).toBe("Add name");
  });

  it("opens the inline editor for the row matching contactEditKey", () => {
    const onContactRename = vi.fn();
    const container = renderContacts({
      allowFrom: ["+111"],
      contactLabels: { "+111": "Old" },
      contactEditKey: "whatsapp:+111",
      overrides: { onContactRename },
    });

    const input = container.querySelector<HTMLInputElement>(".contacts-list__name-input");
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(input!.value).toBe("Old");

    input!.value = "New name";
    const save = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Save",
    );
    save!.click();
    expect(onContactRename).toHaveBeenCalledWith("whatsapp", "+111", "New name");
  });

  it("passes the typed name as a label when adding a single contact", () => {
    const onContactsAdd = vi.fn();
    const container = renderContacts({ overrides: { onContactsAdd } });

    const name = container.querySelector<HTMLInputElement>(".contacts-name");
    const phone = container.querySelector<HTMLInputElement>('input[type="tel"]');
    expect(name).toBeInstanceOf(HTMLInputElement);
    expect(phone).toBeInstanceOf(HTMLInputElement);

    name!.value = "Aasrith";
    phone!.value = "+15555550123";
    phone!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(onContactsAdd).toHaveBeenCalledWith("whatsapp", ["+15555550123"], {
      "+15555550123": "Aasrith",
    });
    expect(name!.value).toBe("");
  });

  it("hides name affordances for channels without contactLabels support", () => {
    const container = renderContacts({
      channelId: "googlechat",
      allowFrom: ["user-1"],
      contactLabels: { "user-1": "Someone" },
    });

    expect(container.querySelector(".contacts-name")).toBeNull();
    expect(container.querySelector(".contacts-list__name")).toBeNull();
    expect(container.querySelector(".contacts-list__addname")).toBeNull();
  });
});

describe("channel setup guides", () => {
  it("provides a guided setup for every bundled channel", () => {
    for (const key of [
      "whatsapp",
      "telegram",
      "discord",
      "slack",
      "signal",
      "googlechat",
      "imessage",
      "nostr",
    ]) {
      expect(hasChannelSetupGuide(key), `guide for ${key}`).toBe(true);
    }
    expect(hasChannelSetupGuide("guildchat")).toBe(false);
  });

  it("renders signal setup fields and enables connect once required fields are filled", () => {
    const props = createProps(null);
    props.configForm = {
      channels: {
        signal: { account: "+919876543210", httpUrl: "http://localhost:8080" },
      },
    };
    const container = document.createElement("div");
    render(renderChannelSetup("signal", props), container);

    const inputs = Array.from(container.querySelectorAll("input"));
    expect(inputs.map((input) => input.value)).toEqual(["+919876543210", "http://localhost:8080"]);
    const connect = container.querySelector<HTMLButtonElement>(".ch-setup__actions button");
    expect(connect?.disabled).toBe(false);
  });

  it("keeps googlechat connect disabled until the audience type is chosen", () => {
    const props = createProps(null);
    props.configForm = {
      channels: {
        googlechat: {
          serviceAccountFile: "C:\\keys\\svc.json",
          audience: "123456789012",
        },
      },
    };
    const container = document.createElement("div");
    render(renderChannelSetup("googlechat", props), container);

    const select = container.querySelector<HTMLSelectElement>("select.ch-setup__input");
    expect(select).not.toBeNull();
    expect(Array.from(select!.options).map((option) => option.value)).toEqual([
      "",
      "project-number",
      "app-url",
    ]);
    const connect = container.querySelector<HTMLButtonElement>(".ch-setup__actions button");
    expect(connect?.disabled).toBe(true);

    props.configForm = {
      channels: {
        googlechat: {
          serviceAccountFile: "C:\\keys\\svc.json",
          audience: "123456789012",
          audienceType: "project-number",
        },
      },
    };
    render(renderChannelSetup("googlechat", props), container);
    const connectAfter = container.querySelector<HTMLButtonElement>(".ch-setup__actions button");
    expect(connectAfter?.disabled).toBe(false);
  });

  it("renders the nostr secret key field as a password input", () => {
    const props = createProps(null);
    const container = document.createElement("div");
    render(renderChannelSetup("nostr", props), container);

    const input = container.querySelector<HTMLInputElement>("input.ch-setup__input");
    expect(input?.type).toBe("password");
    expect(input?.placeholder).toContain("nsec");
    const connect = container.querySelector<HTMLButtonElement>(".ch-setup__actions button");
    expect(connect?.disabled).toBe(true);
  });
});
