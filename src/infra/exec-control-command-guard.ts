import { normalizeLowercaseStringOrEmpty } from "@daisyclaw/normalization-core/string-coerce";
import { normalizeStringEntries } from "@daisyclaw/normalization-core/string-normalization";
import { splitShellArgs } from "../utils/shell-argv.js";
import { buildCommandPayloadCandidates } from "./command-analysis/risks.js";
import { analyzeShellCommand } from "./exec-approvals-analysis.js";

type ParsedExecApprovalCommand = {
  approvalId: string;
  decision: "allow-once" | "allow-always" | "deny";
};

export type UnsafeExecControlShellCommandKind = "approve" | "channel-login";

export function parseExecApprovalShellCommand(raw: string): ParsedExecApprovalCommand | null {
  const normalized = raw.trimStart();
  const match = normalized.match(
    /^\/approve(?:@[^\s]+)?\s+([A-Za-z0-9][A-Za-z0-9._:-]*)\s+(allow-once|allow-always|always|deny)\b/i,
  );
  if (!match) {
    return null;
  }
  return {
    approvalId: match[1],
    decision:
      normalizeLowercaseStringOrEmpty(match[2]) === "always"
        ? "allow-always"
        : (normalizeLowercaseStringOrEmpty(match[2]) as ParsedExecApprovalCommand["decision"]),
  };
}

function normalizeCommandBaseName(token: string | undefined): string {
  if (!token) {
    return "";
  }
  const base = normalizeLowercaseStringOrEmpty(token.split(/[\\/]/u).at(-1));
  return base.replace(/\.(?:cmd|exe)$/u, "");
}

function stripDaisyClawPackageRunner(argv: string[]): string[] {
  const commandName = normalizeCommandBaseName(argv[0]);
  if (commandName === "daisyclaw") {
    return argv;
  }
  if (
    (commandName === "pnpm" || commandName === "npm" || commandName === "yarn") &&
    normalizeCommandBaseName(argv[1]) === "daisyclaw"
  ) {
    return argv.slice(1);
  }
  if (
    (commandName === "pnpm" || commandName === "npm" || commandName === "yarn") &&
    (argv[1] === "exec" || argv[1] === "dlx" || argv[1] === "run") &&
    normalizeCommandBaseName(argv[2]) === "daisyclaw"
  ) {
    return argv.slice(2);
  }
  if (commandName === "npx" || commandName === "bunx") {
    let idx = 1;
    while (idx < argv.length) {
      const token = argv[idx];
      if (token === "--") {
        idx += 1;
        break;
      }
      if (!token.startsWith("-") || token === "-") {
        break;
      }
      idx += 1;
      if ((token === "-p" || token === "--package") && idx < argv.length) {
        idx += 1;
      }
    }
    if (normalizeCommandBaseName(argv[idx]) === "daisyclaw") {
      return argv.slice(idx);
    }
  }
  return argv;
}

export function parseDaisyClawChannelsLoginShellCommand(raw: string): boolean {
  const argv = splitShellArgs(raw);
  if (!argv) {
    return false;
  }
  const daisyclawArgv = stripDaisyClawPackageRunner(argv);
  return (
    normalizeCommandBaseName(daisyclawArgv[0]) === "daisyclaw" &&
    (daisyclawArgv[1] === "channels" || daisyclawArgv[1] === "channel") &&
    daisyclawArgv[2] === "login"
  );
}

export function detectUnsafeExecControlShellCommand(
  command: string,
): UnsafeExecControlShellCommandKind | null {
  const rawCommand = command.trim();
  const analysis = analyzeShellCommand({ command: rawCommand });
  const candidates = analysis.ok
    ? analysis.segments.flatMap((segment) => buildCommandPayloadCandidates(segment.argv))
    : normalizeStringEntries(rawCommand.split(/\r?\n/)).flatMap((line) => {
        const argv = splitShellArgs(line);
        return argv ? buildCommandPayloadCandidates(argv) : [line];
      });
  for (const candidate of candidates) {
    if (parseExecApprovalShellCommand(candidate)) {
      return "approve";
    }
    if (parseDaisyClawChannelsLoginShellCommand(candidate)) {
      return "channel-login";
    }
  }
  return null;
}

export function rejectUnsafeExecControlShellCommand(command: string): void {
  const unsafeKind = detectUnsafeExecControlShellCommand(command);
  if (unsafeKind === "approve") {
    throw new Error(
      [
        "exec cannot run /approve commands.",
        "Show the /approve command to the user as chat text, or route it through the approval command handler instead of shell execution.",
      ].join(" "),
    );
  }
  if (unsafeKind === "channel-login") {
    throw new Error(
      [
        "exec cannot run interactive DaisyClaw channel login commands.",
        "Run `daisyclaw channels login` in a terminal on the gateway host, or use the channel-specific login agent tool when available (for WhatsApp: `whatsapp_login`).",
      ].join(" "),
    );
  }
}
