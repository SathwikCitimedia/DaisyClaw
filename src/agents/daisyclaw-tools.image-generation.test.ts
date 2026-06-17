// Verifies image-generation tool registration through the shared generation harness.
import { describeDaisyClawGenerationToolRegistration } from "./daisyclaw-tools.generation.test-support.js";

describeDaisyClawGenerationToolRegistration({
  suiteName: "daisyclaw tools image generation registration",
  toolName: "image_generate",
  toolLabel: "an image-generation tool",
});
