import { describe, expect, it } from "vitest";
import { describeVoiceError } from "./voice-error.ts";

describe("describeVoiceError", () => {
  it("maps a 429 to a plain-language message and offers browser voice", () => {
    const result = describeVoiceError("Realtime WebRTC setup failed (429)", "webrtc");
    expect(result.message).toMatch(/busy|limit/i);
    expect(result.fix).toEqual({ kind: "switch-to-browser", label: "Use free browser voice" });
  });

  it("offers retry instead of browser switch when browser voice itself failed", () => {
    const result = describeVoiceError("Voice service returned 429", "browser");
    expect(result.fix?.kind).toBe("retry");
  });

  it("treats auth failures as a provider problem with a browser fallback", () => {
    const result = describeVoiceError("Request failed with status 401 Unauthorized", "webrtc");
    expect(result.message).toMatch(/account or key/i);
    expect(result.fix?.kind).toBe("switch-to-browser");
  });

  it("suggests browser voice when the provider is not configured", () => {
    const result = describeVoiceError('Realtime voice provider "openai" is not configured');
    expect(result.fix?.kind).toBe("switch-to-browser");
  });

  it("does not offer a fix when the browser itself lacks voice support", () => {
    const result = describeVoiceError(
      "Voice input is not supported in this browser. Try Chrome or Edge.",
    );
    expect(result.fix).toBeUndefined();
  });

  it("suggests retry for a blocked microphone", () => {
    const result = describeVoiceError("Microphone access was blocked. Allow the mic and retry.");
    expect(result.fix?.kind).toBe("retry");
  });

  it("keeps the raw message but offers retry for unknown errors", () => {
    const result = describeVoiceError("Something weird happened");
    expect(result.message).toBe("Something weird happened");
    expect(result.fix?.kind).toBe("retry");
  });
});
