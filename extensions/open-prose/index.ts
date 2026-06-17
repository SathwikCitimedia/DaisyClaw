// Open Prose plugin entrypoint registers its DaisyClaw integration.
import { definePluginEntry, type DaisyClawPluginApi } from "./runtime-api.js";

export default definePluginEntry({
  id: "open-prose",
  name: "OpenProse",
  description: "Plugin-shipped prose skills bundle",
  register(_api: DaisyClawPluginApi) {
    // OpenProse is delivered via plugin-shipped skills.
  },
});
