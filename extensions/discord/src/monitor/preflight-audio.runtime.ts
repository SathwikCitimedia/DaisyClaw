// Discord plugin module implements preflight audio behavior.
import { transcribeFirstAudio as transcribeFirstAudioImpl } from "daisyclaw/plugin-sdk/media-runtime";

type TranscribeFirstAudio = typeof import("daisyclaw/plugin-sdk/media-runtime").transcribeFirstAudio;

export async function transcribeFirstAudio(
  ...args: Parameters<TranscribeFirstAudio>
): ReturnType<TranscribeFirstAudio> {
  return await transcribeFirstAudioImpl(...args);
}
