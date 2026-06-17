// Formats DaisyClaw CLI command snippets for chat-facing command responses.
function quoteShellArg(value: string): string {
  if (process.platform === "win32") {
    return `'${value.replaceAll("'", "''")}'`;
  }
  return `'${value.replaceAll("'", "'\\''")}'`;
}

/** Reconstructs the current DaisyClaw CLI invocation with extra args. */
export function buildCurrentDaisyClawCliArgv(args: string[]): string[] {
  const entry = process.argv[1]?.trim();
  return entry && entry !== process.execPath
    ? [process.execPath, ...process.execArgv, entry, ...args]
    : [process.execPath, ...args];
}

/** Builds a shell-quoted command string for rerunning the current DaisyClaw CLI. */
export function buildCurrentDaisyClawCliCommand(args: string[]): string {
  return buildCurrentDaisyClawCliArgv(args).map(quoteShellArg).join(" ");
}
