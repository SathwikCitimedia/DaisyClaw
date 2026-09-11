/**
 * Detects shell commands that only a POSIX shell can run.
 *
 * On Windows the agent's exec shell is PowerShell, but many skill bodies are
 * written as bash. Commands matching an unambiguously POSIX construct are routed
 * to the bundled bash (Git for Windows) instead of failing in PowerShell.
 *
 * Precision matters more than recall here: a false positive sends a legitimate
 * PowerShell command to bash and breaks it, while a false negative merely leaves
 * today's behavior unchanged. Every pattern below is therefore invalid or
 * meaningless in PowerShell — ambiguous constructs (pipes, `&&`, `$(...)`,
 * backticks, `$HOME`) are deliberately NOT matched because PowerShell has its
 * own valid meaning for each.
 */

export type PosixShellSignal = {
  name: string;
  pattern: RegExp;
};

export const POSIX_SHELL_SIGNALS: readonly PosixShellSignal[] = [
  // Heredocs: `<<EOF`, `<<'PY'`, `<<-EOF`. PowerShell uses @'...'@ instead.
  { name: "heredoc", pattern: /<<[-~]?\s*['"]?[A-Za-z_]\w*['"]?/ },
  // Bash parameter expansion with a default/alternate: ${VAR:-x} ${VAR:=x}
  // ${VAR:+x} ${VAR:?x}. Plain ${VAR} is valid PowerShell, so it is excluded.
  { name: "parameter-expansion", pattern: /\$\{\w+:[-=+?]/ },
  // Bare `VAR=value` at command position — an assignment or inline env prefix.
  // PowerShell assignment is always `$VAR = value`, so this is bash-only.
  { name: "shell-assignment", pattern: /(?:^|[;&|]\s*|\bexport\s+)[A-Za-z_]\w*=/ },
  // `export VAR` with no value.
  { name: "export", pattern: /(?:^|[;&|]\s*)export\s+[A-Za-z_]\w*(?:\s|$)/ },
  // POSIX device and temp paths.
  { name: "dev-null", pattern: /\/dev\/(?:null|stdin|stdout|stderr)\b/ },
  { name: "posix-tmp-path", pattern: /(?:^|\s)\/tmp\// },
  // POSIX test brackets: `if [ -z "$x" ]`, `[[ -f x ]]`.
  { name: "test-brackets", pattern: /(?:^|[;&|(]\s*|\bif\s+|\bwhile\s+|\belif\s+)\[\[?\s/ },
  // Shell keyword blocks: `; then`, `; do`, `; done`, `fi`, `esac`.
  { name: "shell-keyword", pattern: /(?:;|\n)\s*(?:then|do|done|fi|esac)\b/ },
  { name: "shell-block-end", pattern: /(?:^|[;&|]\s*)(?:fi|done|esac)\s*(?:;|$)/ },
  // Invoking a shell script directly — PowerShell cannot execute a .sh file.
  { name: "sh-script", pattern: /\.sh(?:\s|$)/ },
  // Shebang lines, i.e. the command writes or is a shell script.
  { name: "shebang", pattern: /#!\s*\/(?:usr\/)?bin\/(?:env\s+)?(?:ba)?sh\b/ },
] as const;

/**
 * True when the command uses syntax that PowerShell cannot run but bash can.
 *
 * Callers use this only to pick a shell; it is not a security check and must
 * never gate approvals.
 */
export function commandNeedsPosixShell(command: string): boolean {
  return matchPosixShellSignal(command) !== undefined;
}

/** Returns the name of the first matching POSIX signal, for logs and tests. */
export function matchPosixShellSignal(command: string): string | undefined {
  if (!command.trim()) {
    return undefined;
  }
  for (const signal of POSIX_SHELL_SIGNALS) {
    if (signal.pattern.test(command)) {
      return signal.name;
    }
  }
  return undefined;
}
