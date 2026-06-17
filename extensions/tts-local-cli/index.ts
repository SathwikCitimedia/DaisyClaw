// Tts Local Cli plugin entrypoint registers its DaisyClaw integration.
import { definePluginEntry } from "daisyclaw/plugin-sdk/plugin-entry";
import { buildCliSpeechProvider } from "./speech-provider.js";

export default definePluginEntry({
  id: "tts-local-cli",
  name: "Local CLI TTS",
  description: "Bundled CLI speech provider for local TTS",
  register(api) {
    api.registerSpeechProvider(buildCliSpeechProvider());
  },
});
