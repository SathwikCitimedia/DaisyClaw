// Applies DaisyClaw's default fs-safe runtime configuration.
import { configureFsSafePython } from "@openclaw/fs-safe/config";

// DaisyClaw does not rely on Python helpers for normal filesystem safety. Tests
// and operators can still opt in with fs-safe's documented env override.
const hasPythonModeOverride =
  process.env.FS_SAFE_PYTHON_MODE != null || process.env.DAISYCLAW_FS_SAFE_PYTHON_MODE != null;

if (!hasPythonModeOverride) {
  configureFsSafePython({ mode: "off" });
}
