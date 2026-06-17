// Identifies DaisyClaw-authored assistant rows that are transcript bookkeeping,
// not provider model output. Some history surfaces keep gateway-injected rows
// visible, so use the narrower delivery-mirror predicate when visibility matters.
export const TRANSCRIPT_ONLY_DAISYCLAW_ASSISTANT_MODELS = new Set<string>([
  "delivery-mirror",
  "gateway-injected",
]);

export function isTranscriptOnlyDaisyClawAssistantModel(provider: unknown, model: unknown): boolean {
  return (
    provider === "daisyclaw" &&
    typeof model === "string" &&
    TRANSCRIPT_ONLY_DAISYCLAW_ASSISTANT_MODELS.has(model)
  );
}

export function isTranscriptOnlyDaisyClawAssistantMessage(message: unknown): boolean {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return false;
  }
  const entry = message as { role?: unknown; provider?: unknown; model?: unknown };
  return (
    entry.role === "assistant" &&
    isTranscriptOnlyDaisyClawAssistantModel(entry.provider, entry.model)
  );
}

export function isDaisyClawDeliveryMirrorAssistantMessage(message: unknown): boolean {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return false;
  }
  const entry = message as { role?: unknown; provider?: unknown; model?: unknown };
  return (
    entry.role === "assistant" && entry.provider === "daisyclaw" && entry.model === "delivery-mirror"
  );
}
