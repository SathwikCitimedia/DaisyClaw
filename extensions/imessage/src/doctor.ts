// Imessage plugin module implements doctor behavior.
import type { ChannelDoctorAdapter } from "daisyclaw/plugin-sdk/channel-contract";
import { collectIMessageDuplicateAccountSourceWarnings } from "./accounts.js";

export const imessageDoctor: ChannelDoctorAdapter = {
  groupAllowFromFallbackToAllowFrom: false,
  collectPreviewWarnings: ({ cfg }) => collectIMessageDuplicateAccountSourceWarnings({ cfg }),
};
