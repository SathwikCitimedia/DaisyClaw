import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";

const MOODGRAPH_BASE_URL = "https://api.moodgraph.ai/v1";
const REGISTRATION_CACHE_FILENAME = "moodgraph-registrations.json";

/** Providers moodgraph's API accepts. Anything else must map to one of these. */
type MoodgraphProvider = "openai" | "anthropic" | "gemini" | "custom";

export interface MoodgraphRegisterConfig {
  provider: string;
  model: string;
  api_key: string;
  base_url: string;
  system_prompt: string;
}

/** The LLM the end user configured for this session. */
export interface MoodgraphSessionTarget {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
}

export interface MoodgraphGenerateParams {
  session: MoodgraphSessionTarget;
  sessionId: string;
  message: string;
  systemPrompt: string;
}

export interface MoodgraphGenerateResult {
  text: string;
  /** Which LLM moodgraph generated through. */
  via: "user" | "fallback";
}

interface MoodgraphChatResponse {
  response: string;
  session_id: string;
  metadata?: unknown;
}

type CallResult<T> = { ok: true; value: T } | { ok: false; detail: string; status?: number };

/**
 * Maps an arbitrary provider id (as configured by the user / session model) onto
 * a provider moodgraph understands. moodgraph only accepts openai/anthropic/gemini
 * natively; everything else (litellm, openrouter, vllm, ...) is an OpenAI-compatible
 * proxy and must go through "custom" with an explicit base_url.
 */
function mapMoodgraphProvider(provider: string): MoodgraphProvider {
  const p = provider.toLowerCase();
  if (p.includes("anthropic") || p.includes("claude")) {
    return "anthropic";
  }
  if (p.includes("gemini") || p.includes("google") || p.includes("vertex")) {
    return "gemini";
  }
  if (p === "openai" || p.includes("azure")) {
    return "openai";
  }
  return "custom";
}

/**
 * moodgraph's "custom" backend appends its own `/v1/chat/completions` path, so the
 * registered base_url must be the origin WITHOUT a trailing `/v1` — otherwise the
 * path doubles up (".../v1/v1/chat/completions") and moodgraph gets a 404. A
 * config base_url like "http://host:4000/v1" (correct for direct OpenAI-style
 * calls) must be trimmed to "http://host:4000" for moodgraph.
 *
 * Note: we do NOT pre-judge reachability by IP. moodgraph reaches whatever it can
 * route to (including private/LAN addresses in many deployments); a genuinely
 * unreachable endpoint surfaces as a backend timeout, which the fallback handles.
 */
function normalizeCustomBaseUrl(rawUrl: string): string {
  return rawUrl.replace(/\/+$/, "").replace(/\/v1$/i, "");
}

class MoodgraphClient {
  private readonly registrationCache = new Map<string, string>();
  /**
   * Config hashes that failed this process (unsupported provider, unreachable
   * endpoint, upstream auth error, ...). Kept in memory only so a restart
   * re-probes — networking/keys may have changed in the meantime.
   */
  private readonly knownBadConfigs = new Set<string>();
  private cacheLoaded = false;

  private get apiKey(): string | undefined {
    return process.env["MOODGRAPH_API_KEY"];
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private cacheFilePath(): string {
    return path.join(resolveStateDir(), REGISTRATION_CACHE_FILENAME);
  }

  /**
   * Hydrate the in-memory registration cache from disk once per process. Without
   * this, the cache is empty after every gateway restart, forcing a blocking
   * /register round-trip on the first chat message. Persisted entries are keyed
   * by a hash of the config (the raw api key is never stored — only its digest).
   */
  private loadCacheFromDisk(): void {
    if (this.cacheLoaded) {
      return;
    }
    this.cacheLoaded = true;
    try {
      const raw = fs.readFileSync(this.cacheFilePath(), "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const [hash, id] of Object.entries(parsed)) {
        if (typeof id === "string" && id) {
          this.registrationCache.set(hash, id);
        }
      }
    } catch {
      // Missing/corrupt cache file is non-fatal — we just re-register on demand.
    }
  }

  private saveCacheToDisk(): void {
    try {
      const obj = Object.fromEntries(this.registrationCache);
      fs.writeFileSync(this.cacheFilePath(), JSON.stringify(obj), "utf8");
    } catch {
      // Best-effort persistence; failure only costs a re-register next restart.
    }
  }

  private configHash(config: MoodgraphRegisterConfig): string {
    return createHash("sha256")
      .update(
        [config.provider, config.model, config.api_key, config.base_url, config.system_prompt].join(
          "|",
        ),
      )
      .digest("hex");
  }

  private async register(config: MoodgraphRegisterConfig): Promise<CallResult<string>> {
    this.loadCacheFromDisk();
    const hash = this.configHash(config);
    const cached = this.registrationCache.get(hash);
    if (cached) {
      return { ok: true, value: cached };
    }

    let response: Response;
    try {
      response = await fetch(`${MOODGRAPH_BASE_URL}/register`, {
        method: "POST",
        headers: {
          accept: "*/*",
          "content-type": "application/json",
          "x-api-key": this.apiKey!,
        },
        body: JSON.stringify(config),
      });
    } catch (err) {
      return { ok: false, detail: `network error: ${String(err)}` };
    }

    if (!response.ok) {
      const detail = await readErrorDetail(response);
      return { ok: false, detail, status: response.status };
    }

    let data: { registration_id?: string };
    try {
      data = (await response.json()) as { registration_id?: string };
    } catch {
      return { ok: false, detail: "register response was not JSON", status: response.status };
    }
    if (!data.registration_id) {
      return {
        ok: false,
        detail: "register response missing registration_id",
        status: response.status,
      };
    }

    this.registrationCache.set(hash, data.registration_id);
    this.saveCacheToDisk();
    return { ok: true, value: data.registration_id };
  }

  private async chat(params: {
    registration_id: string;
    session_id: string;
    message: string;
  }): Promise<CallResult<string>> {
    let response: Response;
    try {
      response = await fetch(`${MOODGRAPH_BASE_URL}/chat`, {
        method: "POST",
        headers: {
          accept: "*/*",
          "content-type": "application/json",
          "x-api-key": this.apiKey!,
        },
        body: JSON.stringify(params),
      });
    } catch (err) {
      return { ok: false, detail: `network error: ${String(err)}` };
    }

    if (!response.ok) {
      const detail = await readErrorDetail(response);
      return { ok: false, detail, status: response.status };
    }

    let data: MoodgraphChatResponse;
    try {
      data = (await response.json()) as MoodgraphChatResponse;
    } catch {
      return { ok: false, detail: "chat response was not JSON", status: response.status };
    }
    if (typeof data.response !== "string") {
      return { ok: false, detail: "chat response missing response field", status: response.status };
    }
    return { ok: true, value: data.response };
  }

  /**
   * Builds the registration config for the user's own configured LLM, or null if
   * it can't be expressed for moodgraph (no key, or a "custom" provider with no
   * endpoint to call). Reachability is NOT pre-judged — we let moodgraph try and
   * fall back only on a real failure.
   */
  private buildUserConfig(
    target: MoodgraphSessionTarget,
    systemPrompt: string,
  ): MoodgraphRegisterConfig | null {
    if (!target.apiKey) {
      return null;
    }
    const provider = mapMoodgraphProvider(target.provider);
    if (provider === "custom") {
      // "custom" requires an explicit endpoint for moodgraph to call.
      if (!target.baseUrl) {
        return null;
      }
      return {
        provider,
        model: target.model,
        api_key: target.apiKey,
        base_url: normalizeCustomBaseUrl(target.baseUrl),
        system_prompt: systemPrompt,
      };
    }
    // Native provider (openai/anthropic/gemini): empty base_url = provider's
    // public default; a configured base_url is forwarded as-is.
    return {
      provider,
      model: target.model,
      api_key: target.apiKey,
      base_url: target.baseUrl,
      system_prompt: systemPrompt,
    };
  }

  /**
   * Builds the configured cloud fallback registration (used when the user's own
   * LLM is unreachable/unusable), or null if no fallback is configured.
   */
  private buildFallbackConfig(
    target: MoodgraphSessionTarget,
    systemPrompt: string,
  ): MoodgraphRegisterConfig | null {
    const provider = process.env["MOODGRAPH_FALLBACK_PROVIDER"];
    const apiKey = process.env["MOODGRAPH_FALLBACK_KEY"];
    if (!provider || !apiKey) {
      return null;
    }
    return {
      provider: mapMoodgraphProvider(provider),
      model: process.env["MOODGRAPH_FALLBACK_MODEL"] ?? target.model,
      api_key: apiKey,
      base_url: process.env["MOODGRAPH_FALLBACK_BASE_URL"] ?? "",
      system_prompt: systemPrompt,
    };
  }

  private async runCandidate(
    config: MoodgraphRegisterConfig,
    sessionId: string,
    message: string,
  ): Promise<CallResult<string>> {
    const reg = await this.register(config);
    if (!reg.ok) {
      return reg;
    }
    return this.chat({ registration_id: reg.value, session_id: sessionId, message });
  }

  /**
   * Produce a moodgraph-styled response. Tries the user's own LLM first (when
   * reachable), then a configured cloud fallback. Returns null only if no path
   * succeeds — the caller should then fall back to the raw LLM and log loudly.
   */
  async generate(
    params: MoodgraphGenerateParams,
  ): Promise<MoodgraphGenerateResult | { text: null; errors: string[] }> {
    const errors: string[] = [];
    const userConfig = this.buildUserConfig(params.session, params.systemPrompt);
    const userHash = userConfig ? this.configHash(userConfig) : null;

    if (userConfig && userHash && !this.knownBadConfigs.has(userHash)) {
      const result = await this.runCandidate(userConfig, params.sessionId, params.message);
      if (result.ok) {
        return { text: result.value, via: "user" };
      }
      this.knownBadConfigs.add(userHash);
      errors.push(`user LLM (${userConfig.provider}): ${result.detail}`);
    } else if (!userConfig) {
      errors.push("user LLM not usable via moodgraph (no key or unreachable custom endpoint)");
    }

    const fallbackConfig = this.buildFallbackConfig(params.session, params.systemPrompt);
    if (fallbackConfig) {
      const result = await this.runCandidate(fallbackConfig, params.sessionId, params.message);
      if (result.ok) {
        return { text: result.value, via: "fallback" };
      }
      errors.push(`fallback LLM (${fallbackConfig.provider}): ${result.detail}`);
    } else {
      errors.push("no MOODGRAPH_FALLBACK_PROVIDER/MOODGRAPH_FALLBACK_KEY configured");
    }

    return { text: null, errors };
  }

  /**
   * Feed a turn to moodgraph purely so its stateful emotional engine advances
   * (Option B: moodgraph observes; the DaisyClaw agent still produces the actual
   * reply with full capabilities). The generated text is intentionally discarded —
   * we only care that the session's emotional/coherence trajectory keeps tracking,
   * which is then queryable via /v1/emotions and /v1/coherence. Best-effort: a
   * failure here must never affect the user's reply.
   */
  async observe(params: MoodgraphGenerateParams): Promise<{ ok: boolean }> {
    const result = await this.generate(params);
    return { ok: "via" in result };
  }
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const body = await response.text();
    return body.slice(0, 300);
  } catch {
    return `HTTP ${response.status}`;
  }
}

export const moodgraphClient = new MoodgraphClient();
