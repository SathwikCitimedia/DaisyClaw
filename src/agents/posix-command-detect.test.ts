import { describe, expect, it } from "vitest";
import { commandNeedsPosixShell, matchPosixShellSignal } from "./posix-command-detect.js";

describe("commandNeedsPosixShell", () => {
  it("ignores empty input", () => {
    expect(commandNeedsPosixShell("")).toBe(false);
    expect(commandNeedsPosixShell("   ")).toBe(false);
  });

  describe("detects unambiguously POSIX syntax", () => {
    const cases: Array<[label: string, command: string, signal: string]> = [
      ["heredoc", "cat >\"$PROMPT\" <<'EOF'\nhello\nEOF", "heredoc"],
      ["python heredoc", "python - <<'PY'\nprint(1)\nPY", "heredoc"],
      [
        "default expansion",
        'STATE_DIR="${DAISYCLAW_STATE_DIR:-$HOME/.daisyclaw}"',
        "parameter-expansion",
      ],
      ["bare assignment", "PROMPT=$(mktemp -t prompt)", "shell-assignment"],
      ["inline env prefix", "NODE_PATH=/tmp/cdp-tools node script.js", "shell-assignment"],
      ["export with value", 'export TRELLO_KEY="abc"', "shell-assignment"],
      ["export without value", "export PATH", "export"],
      ["dev null redirect", "gh auth status 2>/dev/null", "dev-null"],
      ["posix tmp path", "mkdir -p /tmp/cdp-tools", "posix-tmp-path"],
      ["test brackets", 'if [ -z "$GH_TOKEN" ]; then echo no; fi', "test-brackets"],
      ["double brackets", "[[ -f README.md ]] && echo yes", "test-brackets"],
      ["for loop", "for f in *.jsonl; do wc -l $f; done", "shell-keyword"],
      ["sh script", "./scripts/transcribe.sh audio.mp3", "sh-script"],
      ["shebang", "#!/usr/bin/env bash\necho hi", "shebang"],
    ];

    for (const [label, command, signal] of cases) {
      it(label, () => {
        expect(commandNeedsPosixShell(command)).toBe(true);
        expect(matchPosixShellSignal(command)).toBe(signal);
      });
    }
  });

  describe("leaves PowerShell and ambiguous commands alone", () => {
    const cases: Array<[label: string, command: string]> = [
      ["powershell assignment", '$StateDir = Join-Path $env:USERPROFILE ".daisyclaw"'],
      ["powershell env assignment", '$env:PATH = "C:\\tools;$env:PATH"'],
      ["powershell subexpression", "Write-Output $(Get-Date)"],
      ["powershell brace variable", 'Write-Output "${Name}"'],
      ["powershell pipeline", "Get-ChildItem | Select-Object -First 5"],
      ["powershell conditional", 'if (Test-Path "x") { Remove-Item "x" }'],
      ["plain cli call", "gh issue list --limit 10"],
      ["cli with chain", "git add -A && git commit -m done"],
      ["cli with pipe to unix tool", "curl -s https://example.com | jq -r .name"],
      ["quoted equals in argument", 'git commit -m "fix: a=b"'],
      ["docker env flag", "docker run -e FOO=bar alpine"],
      ["windows path", "node C:\\tools\\bin\\thing.js -o out.wav"],
    ];

    for (const [label, command] of cases) {
      it(label, () => {
        expect(matchPosixShellSignal(command)).toBeUndefined();
        expect(commandNeedsPosixShell(command)).toBe(false);
      });
    }
  });
});
