// Openshell plugin entrypoint registers its DaisyClaw integration.
import { definePluginEntry } from "daisyclaw/plugin-sdk/plugin-entry";
import { registerSandboxBackend } from "daisyclaw/plugin-sdk/sandbox";
import {
  createOpenShellSandboxBackendFactory,
  createOpenShellSandboxBackendManager,
} from "./src/backend.js";
import { createOpenShellPluginConfigSchema, resolveOpenShellPluginConfig } from "./src/config.js";

export default definePluginEntry({
  id: "openshell",
  name: "OpenShell Sandbox",
  description: "OpenShell-backed sandbox runtime for agent exec and file tools.",
  configSchema: createOpenShellPluginConfigSchema(),
  register(api) {
    if (api.registrationMode !== "full") {
      return;
    }
    const pluginConfig = resolveOpenShellPluginConfig(api.pluginConfig);
    registerSandboxBackend("openshell", {
      factory: createOpenShellSandboxBackendFactory({
        pluginConfig,
      }),
      manager: createOpenShellSandboxBackendManager({
        pluginConfig,
      }),
      resolveWorkdir: () => pluginConfig.remoteWorkspaceDir,
    });
  },
});
