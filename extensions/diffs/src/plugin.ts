// Diffs plugin module implements plugin behavior.
import fs from "node:fs";
import path from "node:path";
import { resolveLivePluginConfigObject } from "daisyclaw/plugin-sdk/plugin-config-runtime";
import {
  resolvePreferredDaisyClawTmpDir,
  type DaisyClawConfig,
  type DaisyClawPluginApi,
} from "../api.js";
import {
  resolveDiffsPluginDefaults,
  resolveDiffsPluginSecurity,
  resolveDiffsPluginViewerBaseUrl,
} from "./config.js";
import { createDiffsHttpHandler } from "./http.js";
import { DIFFS_AGENT_GUIDANCE } from "./prompt-guidance.js";
import { DiffArtifactStore } from "./store.js";
import { createDiffsTool } from "./tool.js";

const DIFFS_LANGUAGE_PACK_PLUGIN_ID = "diffs-language-pack";

export function registerDiffsPlugin(api: DaisyClawPluginApi): void {
  const store = new DiffArtifactStore({
    rootDir: path.join(resolvePreferredDaisyClawTmpDir(), "daisyclaw-diffs"),
    logger: api.logger,
  });
  const resolveCurrentPluginConfig = () =>
    resolveLivePluginConfigObject(
      api.runtime.config?.current
        ? () => api.runtime.config.current() as DaisyClawConfig
        : undefined,
      "diffs",
      api.pluginConfig as Record<string, unknown>,
    ) ?? {};
  const resolveCurrentAccessConfig = () => {
    const currentConfig = (api.runtime.config?.current?.() ?? api.config) as DaisyClawConfig;
    const pluginConfig = resolveCurrentPluginConfig();
    return {
      allowRemoteViewer: resolveDiffsPluginSecurity(pluginConfig).allowRemoteViewer,
      trustedProxies: currentConfig.gateway?.trustedProxies,
      allowRealIpFallback: currentConfig.gateway?.allowRealIpFallback === true,
    };
  };
  const initialAccessConfig = resolveCurrentAccessConfig();

  api.registerTool(
    (ctx) => {
      const pluginConfig = resolveCurrentPluginConfig();
      return createDiffsTool({
        api,
        store,
        defaults: resolveDiffsPluginDefaults(pluginConfig),
        viewerBaseUrl: resolveDiffsPluginViewerBaseUrl(pluginConfig),
        languagePackAvailable: resolveDiffsLanguagePackAvailability(api),
        context: ctx,
      });
    },
    {
      name: "diffs",
    },
  );
  api.registerHttpRoute({
    path: "/plugins/diffs",
    auth: "plugin",
    match: "prefix",
    handler: createDiffsHttpHandler({
      store,
      logger: api.logger,
      allowRemoteViewer: initialAccessConfig.allowRemoteViewer,
      trustedProxies: initialAccessConfig.trustedProxies,
      allowRealIpFallback: initialAccessConfig.allowRealIpFallback,
      resolveAccessConfig: resolveCurrentAccessConfig,
    }),
  });
  api.on("before_prompt_build", async () => ({
    prependSystemContext: DIFFS_AGENT_GUIDANCE,
  }));
}

export function resolveDiffsLanguagePackAvailability(api: DaisyClawPluginApi): boolean {
  const currentConfig = (api.runtime.config?.current?.() ?? api.config) as DaisyClawConfig;
  const plugins = currentConfig.plugins;
  if (plugins?.enabled === false) {
    return false;
  }
  if (plugins?.deny?.includes(DIFFS_LANGUAGE_PACK_PLUGIN_ID)) {
    return false;
  }
  if (plugins?.allow && !plugins.allow.includes(DIFFS_LANGUAGE_PACK_PLUGIN_ID)) {
    return false;
  }
  if (plugins?.entries?.[DIFFS_LANGUAGE_PACK_PLUGIN_ID]?.enabled === false) {
    return false;
  }
  return hasSiblingLanguagePackRuntime(api.rootDir);
}

function hasSiblingLanguagePackRuntime(rootDir: string | undefined): boolean {
  if (!rootDir) {
    return false;
  }
  const languagePackRoot = path.join(path.dirname(rootDir), DIFFS_LANGUAGE_PACK_PLUGIN_ID);
  const runtimePaths = [
    path.join(languagePackRoot, "assets", "viewer-runtime.js"),
    path.join(languagePackRoot, "dist", "assets", "viewer-runtime.js"),
  ];
  return (
    fs.existsSync(path.join(languagePackRoot, "daisyclaw.plugin.json")) &&
    runtimePaths.some((runtimePath) => fs.existsSync(runtimePath))
  );
}
