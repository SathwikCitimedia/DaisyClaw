// Product/package naming constants that bridge current DaisyClaw manifests with
// legacy Clawdbot keys still seen in older configs and packages.
export const PROJECT_NAME = "daisyclaw" as const;

const LEGACY_PROJECT_NAMES = ["clawdbot"] as const;

export const MANIFEST_KEY = PROJECT_NAME;

/** Manifest keys accepted only for legacy compatibility. */
export const LEGACY_MANIFEST_KEYS = LEGACY_PROJECT_NAMES;

export const MACOS_APP_SOURCES_DIR = "apps/macos/Sources/DaisyClaw" as const;
