// Zalouser plugin module implements setup entry behavior.
import { defineBundledChannelSetupEntry } from "daisyclaw/plugin-sdk/channel-entry-contract";

export default defineBundledChannelSetupEntry({
  importMetaUrl: import.meta.url,
  plugin: {
    specifier: "./setup-plugin-api.js",
    exportName: "zalouserSetupPlugin",
  },
});
