// Device Pair API module exposes the plugin public contract.
export {
  approveDevicePairing,
  clearDeviceBootstrapTokens,
  issueDeviceBootstrapToken,
  PAIRING_SETUP_BOOTSTRAP_PROFILE,
  listDevicePairing,
  revokeDeviceBootstrapToken,
  type DeviceBootstrapProfile,
} from "daisyclaw/plugin-sdk/device-bootstrap";
export { definePluginEntry, type DaisyClawPluginApi } from "daisyclaw/plugin-sdk/plugin-entry";
export {
  resolveGatewayBindUrl,
  resolveGatewayPort,
  resolveTailnetHostWithRunner,
} from "daisyclaw/plugin-sdk/core";
export {
  resolvePreferredDaisyClawTmpDir,
  runPluginCommandWithTimeout,
} from "daisyclaw/plugin-sdk/sandbox";
export { renderQrPngBase64, renderQrPngDataUrl, writeQrPngTempFile } from "./qr-image.js";
