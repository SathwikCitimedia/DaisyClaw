// Googlechat plugin module implements group policy behavior.
import { resolveChannelGroupRequireMention } from "daisyclaw/plugin-sdk/channel-policy";
import type { DaisyClawConfig } from "daisyclaw/plugin-sdk/core";

type GoogleChatGroupContext = {
  cfg: DaisyClawConfig;
  accountId?: string | null;
  groupId?: string | null;
};

export function resolveGoogleChatGroupRequireMention(params: GoogleChatGroupContext): boolean {
  return resolveChannelGroupRequireMention({
    cfg: params.cfg,
    channel: "googlechat",
    groupId: params.groupId,
    accountId: params.accountId,
  });
}
