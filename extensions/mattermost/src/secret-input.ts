// Mattermost plugin module implements secret input behavior.
export type { SecretInput } from "daisyclaw/plugin-sdk/secret-input";
export {
  buildSecretInputSchema,
  hasConfiguredSecretInput,
  normalizeResolvedSecretInputString,
  normalizeSecretInputString,
} from "daisyclaw/plugin-sdk/secret-input";
