// Control UI type declarations define channels contracts.
import type { GatewayBrowserClient } from "../gateway.ts";
import type { ChannelsStatusSnapshot } from "../types.ts";

export type ChannelContactsBusyOp = "add" | "remove" | "rename" | "policy";

export type ChannelsState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  channelsLoading: boolean;
  channelsLoadingProbe?: boolean | null;
  channelsRefreshSeq?: number;
  channelsSnapshot: ChannelsStatusSnapshot | null;
  channelsError: string | null;
  channelsLastSuccess: number | null;
  whatsappLoginMessage: string | null;
  whatsappLoginQrDataUrl: string | null;
  whatsappLoginConnected: boolean | null;
  whatsappBusy: boolean;
  channelDisconnectBusy?: string | null;
  channelConnectBusy?: string | null;
  channelContactsBusy?: string | null;
  channelContactsBusyOp?: ChannelContactsBusyOp | null;
  channelContactsError?: string | null;
  pairingRequests?: PairingRequestEntry[] | null;
  pairingBusy?: string | null;
};

export type PairingRequestEntry = {
  channel: string;
  id: string;
  code: string;
  createdAt: string;
  lastSeenAt: string;
  name?: string;
  accountId?: string;
};
