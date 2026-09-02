import type { PairingRequestEntry } from "../controllers/channels.types.ts";
// Control UI type declarations define channels contracts.
import type {
  ChannelAccountSnapshot,
  ChannelsStatusSnapshot,
  ConfigUiHints,
  DiscordStatus,
  GoogleChatStatus,
  IMessageStatus,
  NostrProfile,
  NostrStatus,
  SignalStatus,
  SlackStatus,
  TelegramStatus,
  WhatsAppStatus,
} from "../types.ts";
import type { NostrProfileFormState } from "./channels.nostr-profile-form.ts";

export type ChannelKey = string;
export type { PairingRequestEntry };

export type ChannelsProps = {
  connected: boolean;
  loading: boolean;
  snapshot: ChannelsStatusSnapshot | null;
  lastError: string | null;
  lastSuccessAt: number | null;
  whatsappMessage: string | null;
  whatsappQrDataUrl: string | null;
  whatsappConnected: boolean | null;
  whatsappBusy: boolean;
  focusChannel?: string | null;
  configSchema: unknown;
  configSchemaLoading: boolean;
  configForm: Record<string, unknown> | null;
  configUiHints: ConfigUiHints;
  configSaving: boolean;
  configFormDirty: boolean;
  nostrProfileFormState: NostrProfileFormState | null;
  nostrProfileAccountId: string | null;
  contactsBusy: string | null;
  contactsBusyOp?: "add" | "remove" | "rename" | "policy" | null;
  contactsError: string | null;
  pairingRequests: PairingRequestEntry[] | null;
  pairingBusy: string | null;
  onContactAdd: (channelId: string, value: string) => void;
  onContactsAdd: (channelId: string, values: string[], labels?: Record<string, string>) => void;
  /** Resolves true when the contact was actually removed (false on failure). */
  onContactRemove: (channelId: string, value: string) => Promise<boolean>;
  onContactRename: (channelId: string, contact: string, name: string) => void;
  /** "<channelId>:<contact>" for the row whose name editor is open. */
  contactEditKey?: string | null;
  onContactEditStart: (channelId: string, contact: string) => void;
  onContactEditCancel: () => void;
  onDmPolicyChange: (channelId: string, policy: string) => void;
  onPairingApprove: (entry: PairingRequestEntry) => void;
  onPairingReject: (entry: PairingRequestEntry) => void;
  onOpenChannel: (channelId: string) => void;
  onCloseChannel: () => void;
  onChannelSetupConnect: (channelId: string) => void;
  channelSetupBusy?: string | null;
  onChannelDisconnect: (channelId: string) => void;
  channelDisconnectBusy?: string | null;
  onChannelEnable: (channelId: string) => void;
  channelEnableBusy?: string | null;
  /** When set, the dialog for this channel shows the guided setup even if configured. */
  setupForcedChannel?: string | null;
  onForceSetup: (channelId: string | null) => void;
  onRefresh: (probe: boolean) => void;
  onWhatsAppConnect: (force: boolean) => void;
  onWhatsAppLogout: () => void;
  onConfigPatch: (path: Array<string | number>, value: unknown) => void;
  onConfigSave: () => void;
  onConfigReload: () => void;
  onNostrProfileEdit: (accountId: string, profile: NostrProfile | null) => void;
  onNostrProfileCancel: () => void;
  onNostrProfileFieldChange: (field: keyof NostrProfile, value: string) => void;
  onNostrProfileSave: () => void;
  onNostrProfileImport: () => void;
  onNostrProfileToggleAdvanced: () => void;
};

export type ChannelsChannelData = {
  whatsapp?: WhatsAppStatus;
  telegram?: TelegramStatus;
  discord?: DiscordStatus | null;
  googlechat?: GoogleChatStatus | null;
  slack?: SlackStatus | null;
  signal?: SignalStatus | null;
  imessage?: IMessageStatus | null;
  nostr?: NostrStatus | null;
  channelAccounts?: Record<string, ChannelAccountSnapshot[]> | null;
};
