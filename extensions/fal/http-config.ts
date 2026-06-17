// Fal helper module supports http config behavior.
import type { AuthProfileStore, DaisyClawConfig } from "daisyclaw/plugin-sdk/provider-auth";
import { resolveApiKeyForProvider } from "daisyclaw/plugin-sdk/provider-auth-runtime";
import {
  resolveProviderHttpRequestConfig,
  type ProviderRequestCapability,
} from "daisyclaw/plugin-sdk/provider-http";
import { normalizeOptionalString } from "daisyclaw/plugin-sdk/string-coerce-runtime";

const DEFAULT_FAL_BASE_URL = "https://fal.run";

type FalAuthenticatedRequest = {
  cfg?: DaisyClawConfig;
  agentDir?: string;
  authStore?: AuthProfileStore;
};

function resolveFalConfiguredBaseUrl(cfg?: DaisyClawConfig): string | undefined {
  return normalizeOptionalString(cfg?.models?.providers?.fal?.baseUrl);
}

export async function resolveFalHttpRequestConfig(params: {
  req: FalAuthenticatedRequest;
  baseUrl?: string;
  capability: ProviderRequestCapability;
}): Promise<ReturnType<typeof resolveProviderHttpRequestConfig>> {
  const auth = await resolveApiKeyForProvider({
    provider: "fal",
    cfg: params.req.cfg,
    agentDir: params.req.agentDir,
    store: params.req.authStore,
  });
  if (!auth.apiKey) {
    throw new Error("fal API key missing");
  }

  return resolveProviderHttpRequestConfig({
    baseUrl: params.baseUrl ?? resolveFalConfiguredBaseUrl(params.req.cfg),
    defaultBaseUrl: DEFAULT_FAL_BASE_URL,
    allowPrivateNetwork: false,
    defaultHeaders: {
      Authorization: `Key ${auth.apiKey}`,
      "Content-Type": "application/json",
    },
    provider: "fal",
    capability: params.capability,
    transport: "http",
  });
}
