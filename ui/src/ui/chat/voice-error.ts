// Control UI chat module maps raw realtime voice errors to plain-language
// messages and a suggested one-click fix, so users see "the voice service is
// busy — use free browser voice" instead of "Realtime WebRTC setup failed
// (429)".

export type VoiceErrorFix = "switch-to-browser" | "retry";

export type VoiceErrorDescription = {
  message: string;
  fix?: { kind: VoiceErrorFix; label: string };
};

const SWITCH_TO_BROWSER: VoiceErrorDescription["fix"] = {
  kind: "switch-to-browser",
  label: "Use free browser voice",
};
const RETRY: VoiceErrorDescription["fix"] = { kind: "retry", label: "Try again" };

// Offer switch-to-browser only when a cloud transport failed; if browser voice
// itself failed, switching to it again would not help.
export function describeVoiceError(
  detail: string,
  currentTransport?: string,
): VoiceErrorDescription {
  const raw = detail.trim();
  const text = raw.toLowerCase();
  const onBrowserTransport = (currentTransport ?? "").trim() === "browser";
  const browserFix = onBrowserTransport ? RETRY : SWITCH_TO_BROWSER;

  if (
    /\b429\b/.test(text) ||
    /rate.?limit/.test(text) ||
    /quota/.test(text) ||
    /too many/.test(text)
  ) {
    return {
      message: "The voice service is busy or over its usage limit right now.",
      fix: browserFix,
    };
  }
  if (/\b401\b|\b403\b/.test(text) || /unauthorized|forbidden|invalid api key/.test(text)) {
    return {
      message: "The voice service rejected the request (an account or key problem).",
      fix: browserFix,
    };
  }
  if (/not configured|not set up|unavailable|no realtime|is not available/.test(text)) {
    return {
      message: "This voice provider is not set up.",
      fix: browserFix,
    };
  }
  if (/not supported/.test(text)) {
    // Browser voice is unavailable in this browser; nothing to switch to.
    return { message: "Voice is not supported in this browser. Try Chrome or Edge." };
  }
  if (/microphone|mic\b|not-allowed|audio-capture|permission/.test(text)) {
    return {
      message:
        "Microphone access was blocked, or no microphone was found. Allow the mic and try again.",
      fix: RETRY,
    };
  }
  if (/gateway not connected|not connected/.test(text)) {
    return { message: "Not connected to the gateway. Reconnect and try again." };
  }
  // Unknown failure: keep the original text but still offer a retry.
  return { message: raw || "Voice setup failed.", fix: RETRY };
}
