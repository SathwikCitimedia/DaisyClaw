/**
 * Resolves whether Codex app-server profiling instrumentation is enabled by
 * DaisyClaw diagnostic flags.
 */
import type { DaisyClawConfig } from "daisyclaw/plugin-sdk/config-contracts";
import { isDiagnosticFlagEnabled } from "daisyclaw/plugin-sdk/diagnostic-runtime";

const PROFILER_FLAGS = ["profiler", "codex.profiler"] as const;

/** Checks the generic and Codex-specific profiler diagnostic flags. */
export function isCodexAppServerProfilerEnabled(
  config?: DaisyClawConfig,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return PROFILER_FLAGS.some((flag) => isDiagnosticFlagEnabled(flag, config, env));
}
