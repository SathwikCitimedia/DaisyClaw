// Qa Matrix plugin entrypoint registers its DaisyClaw integration.
import { definePluginEntry } from "daisyclaw/plugin-sdk/plugin-entry";

export default definePluginEntry({
  id: "qa-matrix",
  name: "QA Matrix",
  description: "Matrix QA transport runner and substrate",
  register() {},
});
