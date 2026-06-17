/**
 * Browser test-support re-exports from shared plugin-sdk test fixtures.
 */
export {
  createCliRuntimeCapture,
  expectGeneratedTokenPersistedToGatewayAuth,
  type CliMockOutputRuntime,
  type CliRuntimeCapture,
} from "daisyclaw/plugin-sdk/test-fixtures";
export {
  createTempHomeEnv,
  withEnv,
  withEnvAsync,
  withFetchPreconnect,
  isLiveTestEnabled,
} from "daisyclaw/plugin-sdk/test-env";
export type { FetchMock, TempHomeEnv } from "daisyclaw/plugin-sdk/test-env";
export type { DaisyClawConfig } from "daisyclaw/plugin-sdk/config-contracts";
