// Tokenjuice API module exposes the plugin public contract.
// The upstream npm package still ships its host adapter under the pre-rename
// "openclaw" export; alias it to the DaisyClaw name used across this plugin.
export { createTokenjuiceOpenClawEmbeddedExtension as createTokenjuiceDaisyClawEmbeddedExtension } from "tokenjuice/openclaw";
