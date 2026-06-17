// Verifies video-generation tool registration through the shared generation harness.
import { describeDaisyClawGenerationToolRegistration } from "./daisyclaw-tools.generation.test-support.js";

describeDaisyClawGenerationToolRegistration({
  suiteName: "daisyclaw tools video generation registration",
  toolName: "video_generate",
  toolLabel: "a video-generation tool",
});
