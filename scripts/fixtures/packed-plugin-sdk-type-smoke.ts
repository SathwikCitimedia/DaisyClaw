// Packed Plugin Sdk Type Smoke script supports DaisyClaw repository automation.
type PublicPluginSdkModules = [
  typeof import("daisyclaw/plugin-sdk"),
  typeof import("daisyclaw/plugin-sdk/channel-entry-contract"),
  typeof import("daisyclaw/plugin-sdk/config-contracts"),
  typeof import("daisyclaw/plugin-sdk/provider-entry"),
  typeof import("daisyclaw/plugin-sdk/runtime-env"),
];

const resolvedModules = null as unknown as PublicPluginSdkModules;

void resolvedModules;
