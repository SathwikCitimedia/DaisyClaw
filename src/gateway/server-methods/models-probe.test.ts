import { describe, expect, it, vi } from "vitest";
import { ErrorCodes } from "../../../packages/gateway-protocol/src/index.js";
import { modelsProbeHandlers, probeOpenAiCompatibleServer } from "./models-probe.js";
import type { RespondFn } from "./types.js";

type Route = { status: number; json?: unknown; headers?: Record<string, string> };

function fakeFetch(routes: Record<string, Route>, calls: string[] = []) {
  return async (url: string) => {
    calls.push(url);
    const route = routes[url];
    if (!route) {
      throw new Error(`ECONNREFUSED ${url}`);
    }
    const headers = new Map(Object.entries(route.headers ?? {}));
    return {
      ok: route.status >= 200 && route.status < 300,
      status: route.status,
      headers: { forEach: (cb: (value: string, key: string) => void) => headers.forEach(cb) },
      text: async () => (route.json === undefined ? "" : JSON.stringify(route.json)),
    };
  };
}

describe("probeOpenAiCompatibleServer", () => {
  it("recognises LiteLLM from its readiness endpoint and lists its models", async () => {
    const result = await probeOpenAiCompatibleServer({
      baseUrl: "http://10.21.66.8:4000/v1/",
      apiKey: "sk-test",
      fetchImpl: fakeFetch({
        "http://10.21.66.8:4000/v1/models": {
          status: 200,
          json: { data: [{ id: "claude-sonnet-4-5" }, { id: "gemini-2.5-flash" }] },
          headers: { "x-litellm-version": "1.72.0" },
        },
        "http://10.21.66.8:4000/health/readiness": {
          status: 200,
          json: { status: "connected", litellm_version: "1.72.0" },
        },
      }),
    });
    expect(result.reachable).toBe(true);
    expect(result.kind).toBe("litellm");
    expect(result.providerId).toBe("litellm");
    expect(result.label).toBe("LiteLLM");
    expect(result.baseUrl).toBe("http://10.21.66.8:4000/v1");
    expect(result.models).toEqual(["claude-sonnet-4-5", "gemini-2.5-flash"]);
    expect(result.version).toBe("1.72.0");
    expect(result.authRejected).toBe(false);
  });

  it("recognises LiteLLM from the response header alone when readiness is locked down", async () => {
    const result = await probeOpenAiCompatibleServer({
      baseUrl: "https://llm.example.com",
      fetchImpl: fakeFetch({
        "https://llm.example.com/v1/models": {
          status: 401,
          json: { error: "auth" },
          headers: { "x-litellm-version": "1.70.1" },
        },
      }),
    });
    expect(result.kind).toBe("litellm");
    expect(result.baseUrl).toBe("https://llm.example.com/v1");
    expect(result.authRejected).toBe(true);
    expect(result.models).toEqual([]);
  });

  it("recognises Ollama and stores the /v1 root", async () => {
    const result = await probeOpenAiCompatibleServer({
      baseUrl: "localhost:11434",
      fetchImpl: fakeFetch({
        "http://localhost:11434/api/tags": {
          status: 200,
          json: { models: [{ name: "llama3.1:8b" }, { name: "qwen2.5" }] },
        },
        "http://localhost:11434/v1/models": {
          status: 200,
          json: { data: [{ id: "llama3.1:8b" }, { id: "qwen2.5" }] },
        },
      }),
    });
    expect(result.kind).toBe("ollama");
    expect(result.providerId).toBe("ollama");
    expect(result.baseUrl).toBe("http://localhost:11434/v1");
    expect(result.models).toEqual(["llama3.1:8b", "qwen2.5"]);
  });

  it("falls back to a generic custom server when only the OpenAI listing answers", async () => {
    const result = await probeOpenAiCompatibleServer({
      baseUrl: "http://gpu-box:8000/v1",
      fetchImpl: fakeFetch({
        "http://gpu-box:8000/v1/models": { status: 200, json: { data: [{ id: "mistral" }] } },
      }),
    });
    expect(result.kind).toBe("openai-compatible");
    expect(result.providerId).toBe("custom");
    expect(result.label).toBe("Custom server");
    expect(result.models).toEqual(["mistral"]);
  });

  it("reports an unreachable server without throwing", async () => {
    const result = await probeOpenAiCompatibleServer({
      baseUrl: "http://10.9.9.9:4000/v1",
      timeoutMs: 50,
      fetchImpl: fakeFetch({}),
    });
    expect(result.reachable).toBe(false);
    expect(result.kind).toBe("unknown");
    expect(result.providerId).toBe("custom");
    expect(result.baseUrl).toBe("http://10.9.9.9:4000/v1");
    expect(result.error).toMatch(/No answer/);
  });

  it("rejects non-http addresses", async () => {
    await expect(
      probeOpenAiCompatibleServer({ baseUrl: "file:///etc/passwd", fetchImpl: fakeFetch({}) }),
    ).rejects.toThrow(/http/);
  });
});

describe("models.probeProvider", () => {
  it("requires baseUrl", async () => {
    const respond = vi.fn();
    await modelsProbeHandlers["models.probeProvider"]({
      req: { type: "req", id: "r", method: "models.probeProvider", params: {} },
      params: {},
      respond: respond as RespondFn,
      client: null,
      isWebchatConnect: () => false,
      context: {} as never,
    });
    const [ok, , error] = respond.mock.calls[0] as [boolean, unknown, { code: string }];
    expect(ok).toBe(false);
    expect(error.code).toBe(ErrorCodes.INVALID_REQUEST);
  });
});
