import { describe, expect, it } from "vitest";
import { classifyLocalModelResolutionFailure, classifyProviderTestFailure } from "./models-test.js";

describe("classifyProviderTestFailure", () => {
  it("names a rejected key", () => {
    const result = classifyProviderTestFailure({
      message: "HTTP 401 Incorrect API key provided: sk-abc",
      provider: "openai",
      model: "gpt-5.4",
    });
    expect(result.reason).toBe("invalid_key");
    expect(result.status).toBe(401);
    expect(result.message).toContain("rejected");
    // The raw provider text (which can carry the key) never reaches the user.
    expect(result.message).not.toContain("sk-abc");
  });

  it("names a rejected Google key even though Google says 400, not 401", () => {
    // Verbatim shape of Google's answer to a wrong key on 2026-09-17: the smoke
    // gate reported it as "could not complete a test message (error 400)".
    const result = classifyProviderTestFailure({
      message:
        '{"error":{"message":"{\n  \\"error\\": {\n    \\"code\\": 400,\n    \\"message\\": \\"API key not valid. Please pass a valid API key.\\",\n    \\"status\\": \\"INVALID_ARGUMENT\\",\n    \\"details\\": [{\\"reason\\": \\"API_KEY_INVALID\\"}]}}"}}',
      provider: "google",
      model: "gemini-2.5-flash",
    });
    expect(result.reason).toBe("invalid_key");
    expect(result.message).toContain("rejected");
  });

  it("names an empty account rather than blaming the key", () => {
    const result = classifyProviderTestFailure({
      message: "429 You exceeded your current quota, please check your plan and billing details",
      provider: "openai",
    });
    expect(result.reason).toBe("no_credit");
  });

  it("names a plain rate limit", () => {
    const result = classifyProviderTestFailure({
      message: "HTTP 429 Too Many Requests",
      provider: "anthropic",
    });
    expect(result.reason).toBe("rate_limited");
  });

  it("names a missing network before anything else", () => {
    const result = classifyProviderTestFailure({
      message: "TypeError: fetch failed (ENOTFOUND api.openai.com)",
      provider: "openai",
    });
    expect(result.reason).toBe("network");
    expect(result.message).toMatch(/internet|VPN/i);
  });

  it("names a model the account cannot use", () => {
    const result = classifyProviderTestFailure({
      message: "404 The model `gpt-5.4` does not exist or you do not have access to it.",
      provider: "openai",
      model: "gpt-5.4",
    });
    expect(result.reason).toBe("model_not_found");
    expect(result.message).toContain("gpt-5.4");
  });

  it("names a missing key", () => {
    const result = classifyProviderTestFailure({
      message: "Missing API key for provider openai",
      provider: "openai",
    });
    expect(result.reason).toBe("no_key");
  });

  it("falls back to an honest unknown", () => {
    const result = classifyProviderTestFailure({
      message: "something odd happened",
      provider: "openai",
    });
    expect(result.reason).toBe("unknown");
    expect(result.ok).toBe(false);
  });
});

describe("classifyLocalModelResolutionFailure", () => {
  // A model id we do not have in the catalog fails here, before any request is
  // made. Reporting that as "your account cannot use it" told users their
  // OpenAI plan was at fault when we had never contacted OpenAI.
  it("does not blame the user's account for a model Daisy does not know", () => {
    const result = classifyLocalModelResolutionFailure({
      message: "Unknown model: openai/gpt-4o",
      provider: "openai",
      model: "gpt-4o",
    });
    expect(result.reason).toBe("unknown_model");
    expect(result.message).toContain("gpt-4o");
    expect(result.message).not.toMatch(/account/i);
    expect(result.status).toBeUndefined();
  });

  it("still reports a missing key as a missing key", () => {
    const result = classifyLocalModelResolutionFailure({
      message: "No API key configured for openai",
      provider: "openai",
    });
    expect(result.reason).toBe("no_key");
  });

  it("keeps an unrecognised local failure free of account claims", () => {
    const result = classifyLocalModelResolutionFailure({
      message: "workspace is not writable",
      provider: "openai",
      model: "gpt-5.4",
    });
    expect(result.ok).toBe(false);
    expect(result.message).not.toMatch(/account/i);
  });
});

describe("an empty 404 is about the address, not the account", () => {
  // Sept 16 laptop report: a LiteLLM server saved without its /v1 path made
  // chat fail with "404 status code (no body)", and the connection test told
  // the user "Your litellm account cannot use claude-sonnet-4-5" — a claim
  // about their account that nothing had ever checked.
  it("names the address instead of blaming the account or the model", () => {
    const verdict = classifyProviderTestFailure({
      message: "404 status code (no body)",
      provider: "litellm",
      model: "claude-sonnet-4-5",
      baseUrl: "http://10.21.66.8:4000",
    });

    expect(verdict.reason).toBe("bad_endpoint");
    expect(verdict.message).toContain("http://10.21.66.8:4000");
    expect(verdict.message).toContain("/v1");
    expect(verdict.message).not.toContain("account");
    expect(verdict.message).not.toContain("claude-sonnet-4-5");
  });

  it("still says so usefully when the address is unknown", () => {
    const verdict = classifyProviderTestFailure({
      message: "404 status code (no body)",
      provider: "litellm",
    });

    expect(verdict.reason).toBe("bad_endpoint");
    expect(verdict.message).toContain("Check it in Settings");
  });

  it("names the address when a self-hosted server answers a plain 404", () => {
    // Ollama and LiteLLM answer a wrong path with a 404 that has a body but
    // never names the model. Those used to be reported as an account problem.
    for (const message of ["404 page not found", '404 {"detail":"Not Found"}', "404 Not Found"]) {
      const verdict = classifyProviderTestFailure({
        message,
        provider: "litellm",
        model: "claude-sonnet-4-5",
        baseUrl: "http://10.0.0.5:4000",
      });
      expect(verdict.reason, message).toBe("bad_endpoint");
      expect(verdict.message, message).toContain("10.0.0.5:4000");
    }
  });

  it("keeps blaming the model when the server actually said so", () => {
    const withBody = classifyProviderTestFailure({
      message: '404 {"error":{"message":"model_not_found","code":404}}',
      provider: "litellm",
      model: "claude-sonnet-4-5",
      baseUrl: "http://10.21.66.8:4000/v1",
    });

    expect(withBody.reason).toBe("model_not_found");
    expect(withBody.message).toContain("claude-sonnet-4-5");
  });

  it("leaves other statuses alone", () => {
    expect(
      classifyProviderTestFailure({
        message: "401 status code (no body)",
        provider: "litellm",
        baseUrl: "http://host/v1",
      }).reason,
    ).toBe("invalid_key");
  });
});
