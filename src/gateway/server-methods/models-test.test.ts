import { describe, expect, it } from "vitest";
import { classifyProviderTestFailure } from "./models-test.js";

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
