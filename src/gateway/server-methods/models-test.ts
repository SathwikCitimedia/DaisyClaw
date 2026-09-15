// `models.testProvider`: prove a provider actually works before the user finds
// out in chat.
//
// The chat surface deliberately hides raw provider errors, which leaves a
// non-technical user staring at "LLM request failed." with no idea whether the
// key is wrong, the account has no credit, the model is not available to them,
// or the machine simply has no internet. This method runs one tiny real
// completion through the same runtime chat uses and turns the outcome into a
// plain-language verdict plus a stable reason code the UI can act on.
import { ErrorCodes, errorShape } from "../../../packages/gateway-protocol/src/index.js";
import type { DaisyClawConfig } from "../../config/config.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { GatewayRequestHandlers } from "./types.js";

const log = createSubsystemLogger("models-test");

/** How long a connection test may take before it is reported as unreachable. */
export const PROVIDER_TEST_TIMEOUT_MS = 20_000;

export type ProviderTestReason =
  | "ok"
  | "no_key"
  | "invalid_key"
  | "no_credit"
  | "rate_limited"
  | "model_not_found"
  | "network"
  | "timeout"
  | "unknown_model"
  | "unknown";

export type ProviderTestResult = {
  ok: boolean;
  reason: ProviderTestReason;
  /** Plain-language, actionable, and safe to show a non-technical user. */
  message: string;
  provider: string;
  model?: string;
  /** HTTP status the provider returned, when there was one. */
  status?: number;
};

/** Words providers use for "your account cannot pay for this request". */
const BILLING_PATTERN =
  /insufficient[_\s]?quota|exceeded your current quota|billing|payment required|no credit|credit balance|out of credits|add funds|subscription/i;
const NETWORK_PATTERN =
  /fetch failed|failed to fetch|enotfound|econnrefused|econnreset|eai_again|ehostunreach|enetunreach|etimedout|socket hang up|network (?:error|is unreachable)|dns|tunnel|proxy|certificate|self[- ]signed|unable to verify/i;
const TIMEOUT_PATTERN = /timed? ?out|timeout|aborted|abortsignal/i;
const MODEL_NOT_FOUND_PATTERN =
  /model[_\s]?not[_\s]?found|does not exist or you do not have access|unknown model|no such model|model .* not (?:found|available|supported)|unsupported model/i;
const MISSING_KEY_PATTERN =
  /missing api key|no api key|api key (?:is )?(?:required|not set|missing)|no credentials|not authenticated|set .*_api_key/i;

/**
 * Turns a failure that happened before any request left this machine into a
 * verdict.
 *
 * This exists because the provider-shaped classifier reads "Unknown model:
 * openai/gpt-4o" — our own words for "that id is not in our catalog" — as the
 * provider saying the account has no access, and told users their OpenAI plan
 * was the problem when nothing had been sent to OpenAI at all. A local failure
 * must never make a claim about the user's account.
 */
export function classifyLocalModelResolutionFailure(params: {
  message: string;
  provider: string;
  model?: string;
}): ProviderTestResult {
  const raw = params.message.trim();
  const base = {
    ok: false as const,
    provider: params.provider,
    ...(params.model ? { model: params.model } : {}),
  };
  if (MISSING_KEY_PATTERN.test(raw)) {
    return {
      ...base,
      reason: "no_key",
      message: `No API key is saved for ${params.provider}. Paste the key and connect again.`,
    };
  }
  if (MODEL_NOT_FOUND_PATTERN.test(raw)) {
    return {
      ...base,
      reason: "unknown_model",
      message: params.model
        ? `Daisy does not know a model called "${params.model}" for ${params.provider}. Pick one from the list.`
        : `Daisy could not work out which ${params.provider} model to use. Pick one from the list.`,
    };
  }
  return {
    ...base,
    reason: "unknown_model",
    message: `Daisy could not set up ${params.model ? `"${params.model}"` : "a model"} for ${params.provider}. Pick a different model.`,
  };
}

function extractHttpStatus(message: string): number | undefined {
  const explicit = message.match(/\b(?:http\s*)?(4\d{2}|5\d{2})\b/);
  if (explicit?.[1]) {
    return Number(explicit[1]);
  }
  return undefined;
}

/**
 * Turns a provider failure into a verdict. Deliberately message-shaped rather
 * than exception-shaped: every provider reports these differently, and the user
 * only cares which of a handful of situations they are in.
 */
export function classifyProviderTestFailure(params: {
  message: string;
  provider: string;
  model?: string;
}): ProviderTestResult {
  const raw = params.message.trim();
  const status = extractHttpStatus(raw);
  const base = {
    ok: false as const,
    provider: params.provider,
    ...(params.model ? { model: params.model } : {}),
  };
  const withStatus = status !== undefined ? { ...base, status } : base;

  if (MISSING_KEY_PATTERN.test(raw)) {
    return {
      ...withStatus,
      reason: "no_key",
      message: `No API key is saved for ${params.provider}. Paste the key and connect again.`,
    };
  }
  if (NETWORK_PATTERN.test(raw)) {
    return {
      ...withStatus,
      reason: "network",
      message:
        "Could not reach the provider. Check this computer's internet connection, and turn on the VPN if the server needs one.",
    };
  }
  if (BILLING_PATTERN.test(raw) || status === 402) {
    return {
      ...withStatus,
      reason: "no_credit",
      message: `${params.provider} accepted the key but the account has no credit left. Add credit or switch to another provider.`,
    };
  }
  if (status === 401 || status === 403) {
    return {
      ...withStatus,
      reason: "invalid_key",
      message: `${params.provider} rejected that API key. Check you copied the whole key, then try again.`,
    };
  }
  if (status === 429) {
    return {
      ...withStatus,
      reason: "rate_limited",
      message: `${params.provider} is rate limiting this key right now. Wait a moment and try again.`,
    };
  }
  if (MODEL_NOT_FOUND_PATTERN.test(raw) || status === 404) {
    return {
      ...withStatus,
      reason: "model_not_found",
      message: params.model
        ? `Your ${params.provider} account cannot use "${params.model}". Pick a different model.`
        : `That model is not available on your ${params.provider} account. Pick a different model.`,
    };
  }
  if (TIMEOUT_PATTERN.test(raw)) {
    return {
      ...withStatus,
      reason: "timeout",
      message: `${params.provider} did not answer in time. Try again; if it keeps happening, check your connection.`,
    };
  }
  return {
    ...withStatus,
    reason: "unknown",
    message: `${params.provider} could not complete a test message${status ? ` (error ${status})` : ""}. The full error is in Daisy's log.`,
  };
}

/** Config clone carrying a candidate API key that has not been saved yet. */
function withCandidateApiKey(
  cfg: DaisyClawConfig,
  providerId: string,
  apiKey: string | undefined,
): DaisyClawConfig {
  if (!apiKey) {
    return cfg;
  }
  const models = (cfg.models ?? {}) as Record<string, unknown>;
  const providers = (models.providers ?? {}) as Record<string, Record<string, unknown>>;
  return {
    ...cfg,
    models: {
      ...models,
      providers: {
        ...providers,
        [providerId]: { ...(providers[providerId] ?? {}), apiKey },
      },
    },
  } as DaisyClawConfig;
}

function resolveDefaultModelForProvider(
  cfg: DaisyClawConfig,
  providerId: string,
): string | undefined {
  const providers = (cfg.models as { providers?: Record<string, unknown> } | undefined)?.providers;
  const provider = providers?.[providerId] as { models?: Array<{ id?: unknown }> } | undefined;
  const listed = provider?.models?.find(
    (entry) => typeof entry?.id === "string" && entry.id.trim().length > 0,
  );
  if (typeof listed?.id === "string") {
    return listed.id;
  }
  const defaults = (cfg.agents as { defaults?: { model?: unknown } } | undefined)?.defaults;
  const model = defaults?.model;
  const ref =
    typeof model === "string"
      ? model
      : typeof (model as { primary?: unknown } | undefined)?.primary === "string"
        ? (model as { primary: string }).primary
        : undefined;
  if (ref?.startsWith(`${providerId}/`)) {
    return ref.slice(providerId.length + 1);
  }
  return undefined;
}

/**
 * Runs one minimal completion against a provider. Resolves to a verdict; never
 * rejects for provider-side problems.
 */
export async function testModelProvider(params: {
  cfg: DaisyClawConfig;
  providerId: string;
  modelId?: string;
  apiKey?: string;
  timeoutMs?: number;
}): Promise<ProviderTestResult> {
  const providerId = params.providerId.trim();
  const cfg = withCandidateApiKey(params.cfg, providerId, params.apiKey?.trim() || undefined);
  const modelId = params.modelId?.trim() || resolveDefaultModelForProvider(cfg, providerId);
  if (!modelId) {
    return {
      ok: false,
      reason: "unknown_model",
      provider: providerId,
      message: `No model is selected for ${providerId} yet. Choose a model and try again.`,
    };
  }

  const { prepareSimpleCompletionModel, completeWithPreparedSimpleCompletionModel } =
    await import("../../agents/simple-completion-runtime.js");
  const prepared = await prepareSimpleCompletionModel({
    cfg,
    provider: providerId,
    modelId,
    useAsyncModelResolution: true,
    skipAgentDiscovery: true,
  });
  if (!("model" in prepared)) {
    // Nothing has been sent anywhere yet, so this is ours to explain, not the
    // provider's to be blamed for.
    return classifyLocalModelResolutionFailure({
      message: prepared.error,
      provider: providerId,
      model: modelId,
    });
  }

  const controller = new AbortController();
  const timeoutMs = params.timeoutMs ?? PROVIDER_TEST_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const result = await completeWithPreparedSimpleCompletionModel({
      model: prepared.model,
      auth: prepared.auth,
      cfg,
      context: {
        systemPrompt: "Reply with the single word: ok",
        messages: [{ role: "user", content: "ok", timestamp: Date.now() }],
      },
      options: { maxTokens: 16, signal: controller.signal },
    });
    if (result.stopReason === "error") {
      const message = result.errorMessage?.trim() || "unknown error";
      log.warn(
        `models.testProvider provider=${providerId} model=${modelId} failed: ${message.slice(0, 400)}`,
      );
      return classifyProviderTestFailure({ message, provider: providerId, model: modelId });
    }
    return {
      ok: true,
      reason: "ok",
      provider: providerId,
      model: modelId,
      message: `Connected to ${providerId}. The model answered a test message.`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn(
      `models.testProvider provider=${providerId} model=${modelId} threw: ${message.slice(0, 400)}`,
    );
    return classifyProviderTestFailure({ message, provider: providerId, model: modelId });
  } finally {
    clearTimeout(timer);
  }
}

export const modelsTestHandlers: GatewayRequestHandlers = {
  "models.testProvider": async ({ params, respond, context }) => {
    const providerId = typeof params?.providerId === "string" ? params.providerId.trim() : "";
    if (!providerId) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "models.testProvider requires providerId"),
      );
      return;
    }
    try {
      const result = await testModelProvider({
        cfg: context.getRuntimeConfig(),
        providerId,
        ...(typeof params?.modelId === "string" ? { modelId: params.modelId } : {}),
        ...(typeof params?.apiKey === "string" ? { apiKey: params.apiKey } : {}),
      });
      respond(true, result, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, err instanceof Error ? err.message : String(err)),
      );
    }
  },
};
