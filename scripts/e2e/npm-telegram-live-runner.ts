// Telegram package Docker harness.
// Runs QA live transport code against the package candidate installed in Docker.

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

function parseBoolean(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function splitCsv(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function resolveCredentialSource(env: NodeJS.ProcessEnv) {
  return env.DAISYCLAW_NPM_TELEGRAM_CREDENTIAL_SOURCE ?? env.DAISYCLAW_QA_CREDENTIAL_SOURCE;
}

function resolveCredentialRole(env: NodeJS.ProcessEnv) {
  return env.DAISYCLAW_NPM_TELEGRAM_CREDENTIAL_ROLE ?? env.DAISYCLAW_QA_CREDENTIAL_ROLE;
}

async function shouldFailPackageTelegramRun(
  result: { summaryPath: string },
  env: NodeJS.ProcessEnv = process.env,
) {
  if (parseBoolean(env.DAISYCLAW_NPM_TELEGRAM_ALLOW_FAILURES)) {
    return false;
  }
  const { readQaSuiteFailedScenarioCountFromFile } =
    await import("../../extensions/qa-lab/src/suite-summary.ts");
  return (await readQaSuiteFailedScenarioCountFromFile(result.summaryPath)) > 0;
}

async function resolveTrustedDaisyClawCommand(rawCommand: string) {
  if (!path.isAbsolute(rawCommand)) {
    throw new Error("DAISYCLAW_NPM_TELEGRAM_SUT_COMMAND must be an absolute path.");
  }
  const commandName = path.basename(rawCommand);
  if (commandName !== "daisyclaw" && commandName !== "daisyclaw.cmd") {
    throw new Error(
      `DAISYCLAW_NPM_TELEGRAM_SUT_COMMAND must point to daisyclaw; got: ${commandName}`,
    );
  }
  const npmPrefix = process.env.NPM_CONFIG_PREFIX?.trim();
  if (!npmPrefix) {
    throw new Error("Missing NPM_CONFIG_PREFIX for installed daisyclaw command validation.");
  }
  const [realCommand, realPrefix] = await Promise.all([
    fs.realpath(rawCommand),
    fs.realpath(npmPrefix),
  ]);
  if (realCommand !== realPrefix && !realCommand.startsWith(`${realPrefix}${path.sep}`)) {
    throw new Error("DAISYCLAW_NPM_TELEGRAM_SUT_COMMAND must resolve inside NPM_CONFIG_PREFIX.");
  }
  return rawCommand;
}

async function main() {
  const { runTelegramQaLive } =
    await import("../../extensions/qa-lab/src/live-transports/telegram/telegram-live.runtime.ts");
  const rawSutDaisyClawCommand = process.env.DAISYCLAW_NPM_TELEGRAM_SUT_COMMAND?.trim();
  if (!rawSutDaisyClawCommand) {
    throw new Error("Missing DAISYCLAW_NPM_TELEGRAM_SUT_COMMAND.");
  }
  const sutDaisyClawCommand = await resolveTrustedDaisyClawCommand(rawSutDaisyClawCommand);

  const repoRoot = path.resolve(process.env.DAISYCLAW_NPM_TELEGRAM_REPO_ROOT ?? process.cwd());
  const outputDir =
    process.env.DAISYCLAW_NPM_TELEGRAM_OUTPUT_DIR?.trim() ||
    path.join(repoRoot, ".artifacts", "qa-e2e", `npm-telegram-live-${Date.now().toString(36)}`);
  const result = await runTelegramQaLive({
    repoRoot,
    outputDir,
    sutDaisyClawCommand,
    preflightInstalledOnboarding: true,
    providerMode: process.env.DAISYCLAW_NPM_TELEGRAM_PROVIDER_MODE,
    primaryModel: process.env.DAISYCLAW_NPM_TELEGRAM_MODEL,
    alternateModel: process.env.DAISYCLAW_NPM_TELEGRAM_ALT_MODEL,
    fastMode: parseBoolean(process.env.DAISYCLAW_NPM_TELEGRAM_FAST),
    scenarioIds: splitCsv(process.env.DAISYCLAW_NPM_TELEGRAM_SCENARIOS),
    sutAccountId: process.env.DAISYCLAW_NPM_TELEGRAM_SUT_ACCOUNT,
    credentialSource: resolveCredentialSource(process.env),
    credentialRole: resolveCredentialRole(process.env),
  });

  process.stdout.write(`Package Telegram QA report: ${result.reportPath}\n`);
  process.stdout.write(`Package Telegram QA summary: ${result.summaryPath}\n`);
  process.stdout.write(`Package Telegram QA observed messages: ${result.observedMessagesPath}\n`);
  if (await shouldFailPackageTelegramRun(result)) {
    process.exitCode = 1;
  }
}

async function formatRunnerErrorMessage(error: unknown) {
  try {
    const { formatErrorMessage } = await import("../../dist/infra/errors.js");
    return formatErrorMessage(error);
  } catch {
    return error instanceof Error ? error.message : String(error);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(async (error: unknown) => {
    process.stderr.write(
      `package telegram live e2e failed: ${await formatRunnerErrorMessage(error)}\n`,
    );
    process.exitCode = 1;
  });
}

export const testing = {
  resolveCredentialRole,
  resolveCredentialSource,
  shouldFailPackageTelegramRun,
};
export { testing as __testing };
