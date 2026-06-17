// Restart helper tests cover update restart helper process selection and error handling.
import { execFile, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prepareRestartScript, runRestartScript } from "./restart-helper.js";

vi.mock("node:child_process", async () => {
  const { mockNodeBuiltinModule } = await import("daisyclaw/plugin-sdk/test-node-mocks");
  return mockNodeBuiltinModule(
    () => vi.importActual<typeof import("node:child_process")>("node:child_process"),
    {
      spawn: vi.fn(),
    },
  );
});

describe("restart-helper", () => {
  const originalPlatform = process.platform;
  const originalGetUid = process.getuid;

  async function prepareAndReadScript(env: Record<string, string>, gatewayPort = 18789) {
    const scriptPath = await prepareRestartScript(env, gatewayPort);
    if (scriptPath == null) {
      throw new Error("expected restart script path");
    }
    const content = await fs.readFile(scriptPath, "utf-8");
    return { scriptPath, content };
  }

  async function cleanupScript(scriptPath: string) {
    await fs.unlink(scriptPath).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    });
    await fs.rmdir(path.dirname(scriptPath)).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    });
  }

  async function makeTempDir(prefix: string) {
    return await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  }

  async function writeFakeLaunchctl(
    fakeBinDir: string,
    content = `#!/bin/sh
echo "launchctl $*" >&2
case "$1" in
  kickstart) exit 0 ;;
  enable|bootstrap) exit 0 ;;
esac
exit 0
`,
  ) {
    const launchctlPath = path.join(fakeBinDir, "launchctl");
    await fs.writeFile(launchctlPath, content, { mode: 0o755 });
  }

  async function writeFakeSleep(fakeBinDir: string) {
    await fs.writeFile(path.join(fakeBinDir, "sleep"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  }

  async function executeScript(scriptPath: string, env: Record<string, string>) {
    return await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
      execFile(
        "/bin/sh",
        [scriptPath],
        { env: { ...process.env, ...env } },
        (error, stdout, stderr) => {
          const execError = error as (Error & { code?: number | string }) | null;
          const code = typeof execError?.code === "number" ? execError.code : null;
          resolve({ code, stdout, stderr });
        },
      );
    });
  }

  function expectWindowsRestartWaitOrdering(content: string, port = 18789) {
    const stateCheck = "$taskState = Get-DaisyClawScheduledTaskState -TaskName $taskName";
    const runningGuard = 'if ($taskState -eq "Running")';
    const endCommand =
      'Invoke-DaisyClawSchtasksWithTimeout -Arguments @("/End", "/TN", $taskName) -TimeoutSeconds 10';
    const skipEndLog = "daisyclaw restart skipped schtasks end";
    const pollLoop = "for ($attempt = 1; $attempt -le 10; $attempt++)";
    const pollCall = `Get-DaisyClawListenerPids -Port $port`;
    const forceKillBranch = "if ($attempt -eq 10)";
    const forceKillCommand = "Stop-Process -Id $listenerPid -Force";
    const runCommand =
      'Invoke-DaisyClawSchtasksWithTimeout -Arguments @("/Run", "/TN", $taskName) -TimeoutSeconds 30';
    const portAssignment = `$port = ${port}`;
    const stateCheckIndex = content.indexOf(stateCheck);
    const runningGuardIndex = content.indexOf(runningGuard, stateCheckIndex);
    const endIndex = content.indexOf(endCommand, runningGuardIndex);
    const skipEndLogIndex = content.indexOf(skipEndLog, endIndex);
    const portAssignmentIndex = content.indexOf(portAssignment);
    const pollLoopIndex = content.indexOf(pollLoop, skipEndLogIndex);
    const pollCallIndex = content.indexOf(pollCall, pollLoopIndex);
    const forceKillBranchIndex = content.indexOf(forceKillBranch, pollCallIndex);
    const forceKillCommandIndex = content.indexOf(forceKillCommand, forceKillBranchIndex);
    const runIndex = content.indexOf(runCommand, forceKillCommandIndex);

    expect(stateCheckIndex).toBeGreaterThanOrEqual(0);
    expect(runningGuardIndex).toBeGreaterThan(stateCheckIndex);
    expect(endIndex).toBeGreaterThan(runningGuardIndex);
    expect(skipEndLogIndex).toBeGreaterThan(endIndex);
    expect(portAssignmentIndex).toBeGreaterThanOrEqual(0);
    expect(pollLoopIndex).toBeGreaterThan(skipEndLogIndex);
    expect(pollCallIndex).toBeGreaterThan(pollLoopIndex);
    expect(forceKillBranchIndex).toBeGreaterThan(pollCallIndex);
    expect(forceKillCommandIndex).toBeGreaterThan(forceKillBranchIndex);
    expect(runIndex).toBeGreaterThan(forceKillCommandIndex);

    expect(content).not.toContain("timeout /t 3 /nobreak >nul");
    expect(content).not.toContain("findstr");
    expect(content).not.toContain("netstat -ano |");
    expect(content).not.toContain("schtasks /End /TN");
  }

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform });
    process.getuid = originalGetUid;
  });

  describe("prepareRestartScript", () => {
    it("creates a systemd restart script on Linux", async () => {
      Object.defineProperty(process, "platform", { value: "linux" });
      const { scriptPath, content } = await prepareAndReadScript({
        DAISYCLAW_PROFILE: "default",
      });
      expect(scriptPath.endsWith(".sh")).toBe(true);
      expect(content).toContain("#!/bin/sh");
      expect(content).toContain("systemctl --user restart 'daisyclaw-gateway.service'");
      // Script should self-cleanup
      expect(content).toContain('rm -f "$0"');
      expect(content).toContain('rmdir "$script_dir" 2>/dev/null || true');
      await cleanupScript(scriptPath);
    });

    it("creates restart scripts in a private temp directory with exclusive creation", async () => {
      Object.defineProperty(process, "platform", { value: "linux" });
      const timestamp = 1_727_201_234_567;
      const oldCandidatePath = path.join(os.tmpdir(), `daisyclaw-restart-${timestamp}.sh`);
      const victimDir = await makeTempDir("daisyclaw-restart-helper-victim-");
      const victimPath = path.join(victimDir, "restart.sh");
      await fs.rm(oldCandidatePath, { force: true });
      await fs.writeFile(victimPath, "preexisting script\n", "utf-8");

      let candidateIsSymlink = false;
      try {
        await fs.symlink(victimPath, oldCandidatePath);
        candidateIsSymlink = true;
      } catch {
        await fs.writeFile(oldCandidatePath, "preexisting script\n", { flag: "wx" });
      }

      const dateSpy = vi.spyOn(Date, "now").mockReturnValue(timestamp);
      const writeFileSpy = vi.spyOn(fs, "writeFile");

      try {
        const { scriptPath } = await prepareAndReadScript({
          DAISYCLAW_PROFILE: "default",
        });
        const scriptDir = path.dirname(scriptPath);
        const relativeScriptDir = path.relative(os.tmpdir(), scriptDir);

        expect(scriptPath).not.toBe(oldCandidatePath);
        expect(scriptDir).not.toBe(os.tmpdir());
        expect(relativeScriptDir).not.toBe("");
        expect(relativeScriptDir.startsWith("..")).toBe(false);
        expect(path.isAbsolute(relativeScriptDir)).toBe(false);
        expect(path.basename(scriptDir)).toMatch(/^daisyclaw-restart-/);
        expect(writeFileSpy).toHaveBeenLastCalledWith(
          scriptPath,
          expect.any(String),
          expect.objectContaining({ flag: "wx", mode: 0o755 }),
        );
        await expect(fs.readFile(victimPath, "utf-8")).resolves.toBe("preexisting script\n");
        if (!candidateIsSymlink) {
          await expect(fs.readFile(oldCandidatePath, "utf-8")).resolves.toBe(
            "preexisting script\n",
          );
        }
        await cleanupScript(scriptPath);
      } finally {
        dateSpy.mockRestore();
        writeFileSpy.mockRestore();
        await fs.rm(oldCandidatePath, { force: true });
        await fs.rm(victimDir, { recursive: true, force: true });
      }
    });

    it("uses DAISYCLAW_SYSTEMD_UNIT override for systemd scripts", async () => {
      Object.defineProperty(process, "platform", { value: "linux" });
      const { scriptPath, content } = await prepareAndReadScript({
        DAISYCLAW_PROFILE: "default",
        DAISYCLAW_SYSTEMD_UNIT: "custom-gateway",
      });
      expect(content).toContain("systemctl --user restart 'custom-gateway.service'");
      await cleanupScript(scriptPath);
    });

    it("fails with sudo systemd guidance when the gateway unit is system-scoped", async () => {
      Object.defineProperty(process, "platform", { value: "linux" });
      const tmpDir = await makeTempDir("daisyclaw-restart-helper-");
      const fakeBinDir = path.join(tmpDir, "bin");
      const callsPath = path.join(tmpDir, "systemctl-calls.log");
      await fs.mkdir(fakeBinDir, { recursive: true });
      await writeFakeSleep(fakeBinDir);
      await fs.writeFile(
        path.join(fakeBinDir, "systemctl"),
        `#!/bin/sh
printf '%s\\n' "$*" >> "$DAISYCLAW_SYSTEMCTL_CALLS"
if [ "$1" = "--user" ] && [ "$2" = "is-active" ]; then exit 3; fi
if [ "$1" = "--user" ] && [ "$2" = "is-enabled" ]; then exit 1; fi
if [ "$1" = "is-active" ] && [ "$2" = "--quiet" ]; then exit 0; fi
if [ "$1" = "is-enabled" ] && [ "$2" = "--quiet" ]; then exit 0; fi
if [ "$1" = "--user" ] && [ "$2" = "restart" ]; then exit 99; fi
exit 1
`,
        { mode: 0o755 },
      );

      const { scriptPath } = await prepareAndReadScript({
        DAISYCLAW_PROFILE: "default",
        HOME: path.join(tmpDir, "home"),
        DAISYCLAW_STATE_DIR: path.join(tmpDir, "state"),
      });
      const result = await executeScript(scriptPath, {
        PATH: `${fakeBinDir}:${process.env.PATH ?? ""}`,
        DAISYCLAW_SYSTEMCTL_CALLS: callsPath,
      });
      const calls = await fs.readFile(callsPath, "utf-8");

      expect(result.code).toBe(78);
      expect(result.stderr).toContain("system-scoped daisyclaw gateway unit detected");
      expect(result.stderr).toContain("sudo systemctl restart daisyclaw-gateway.service");
      expect(calls).toContain("--user is-active --quiet daisyclaw-gateway.service");
      expect(calls).toContain("is-active --quiet daisyclaw-gateway.service");
      expect(calls).not.toContain("--user restart daisyclaw-gateway.service");
    });

    it("creates a launchd restart script on macOS", async () => {
      Object.defineProperty(process, "platform", { value: "darwin" });
      process.getuid = () => 501;

      const { scriptPath, content } = await prepareAndReadScript({
        DAISYCLAW_PROFILE: "default",
      });
      expect(scriptPath.endsWith(".sh")).toBe(true);
      expect(content).toContain("#!/bin/sh");
      expect(content).toContain("launchctl kickstart -k 'gui/501/ai.daisyclaw.gateway'");
      // Should clear disabled state and fall back to bootstrap when kickstart fails.
      expect(content).toContain("launchctl enable 'gui/501/ai.daisyclaw.gateway'");
      expect(content).toContain("launchctl bootstrap 'gui/501'");
      expect(content).toContain("Bootstrap loads RunAtLoad agents");
      expect(content).toContain('rm -f "$0"');
      expect(content).toContain('rmdir "$script_dir" 2>/dev/null || true');
      await cleanupScript(scriptPath);
    });

    it("captures macOS launchctl stderr to ~/.daisyclaw/logs/gateway-restart.log (#68486)", async () => {
      // Silent failure in macOS update restart helper: previously every
      // launchctl call redirected stderr to /dev/null and the final kickstart
      // was chained with `|| true`, so bootstrap/kickstart failures were
      // invisible and the gateway stayed offline while the updater reported
      // success. The script should now route stderr to a durable log file and
      // stop swallowing the final exit code.
      Object.defineProperty(process, "platform", { value: "darwin" });
      process.getuid = () => 501;

      const { scriptPath, content } = await prepareAndReadScript({
        DAISYCLAW_PROFILE: "default",
        HOME: "/Users/testuser",
      });
      expect(content).toContain("exec >>'/Users/testuser/.daisyclaw/logs/gateway-restart.log' 2>&1");
      // Every launchctl call should allow output through now (no `2>/dev/null`)
      // and the final kickstart must not swallow its exit code.
      expect(content).not.toMatch(/launchctl[^\n]*2>\/dev\/null/);
      expect(content).not.toMatch(/launchctl kickstart[^\n]*\|\| true/);
      await cleanupScript(scriptPath);
    });

    it("uses DAISYCLAW_STATE_DIR for the macOS update restart log", async () => {
      Object.defineProperty(process, "platform", { value: "darwin" });
      process.getuid = () => 501;

      const { scriptPath, content } = await prepareAndReadScript({
        DAISYCLAW_PROFILE: "default",
        HOME: "/Users/testuser",
        DAISYCLAW_STATE_DIR: "/tmp/daisyclaw-state",
      });

      expect(content).toContain(
        "if mkdir -p '/tmp/daisyclaw-state/logs' 2>/dev/null && : >>'/tmp/daisyclaw-state/logs/gateway-restart.log' 2>/dev/null; then",
      );
      expect(content).toContain("exec >>'/tmp/daisyclaw-state/logs/gateway-restart.log' 2>&1");
      await cleanupScript(scriptPath);
    });

    it("returns the final macOS launchctl kickstart failure after logging cleanup", async () => {
      Object.defineProperty(process, "platform", { value: "darwin" });
      process.getuid = () => 501;
      const tmpDir = await makeTempDir("daisyclaw-restart-helper-");
      const fakeBinDir = path.join(tmpDir, "bin");
      const stateDir = path.join(tmpDir, "state");
      await fs.mkdir(fakeBinDir, { recursive: true });
      await writeFakeSleep(fakeBinDir);
      await writeFakeLaunchctl(
        fakeBinDir,
        `#!/bin/sh
echo "launchctl $*" >&2
case "$1" in
  kickstart) exit 42 ;;
  enable) exit 0 ;;
  bootstrap) exit 1 ;;
esac
exit 0
`,
      );

      const { scriptPath } = await prepareAndReadScript({
        DAISYCLAW_PROFILE: "default",
        HOME: path.join(tmpDir, "home"),
        DAISYCLAW_STATE_DIR: stateDir,
      });

      const result = await executeScript(scriptPath, {
        PATH: `${fakeBinDir}:${process.env.PATH ?? ""}`,
      });
      const log = await fs.readFile(path.join(stateDir, "logs", "gateway-restart.log"), "utf-8");

      expect(result.code).toBe(42);
      expect(log).toContain("daisyclaw restart attempt source=update target=ai.daisyclaw.gateway");
      expect(log).toContain("launchctl kickstart -k gui/501/ai.daisyclaw.gateway");
      expect(log).toContain("daisyclaw restart failed source=update status=42");
      expect(log).not.toContain("daisyclaw restart done source=update");
    });

    it("continues the macOS restart path when log setup fails", async () => {
      Object.defineProperty(process, "platform", { value: "darwin" });
      process.getuid = () => 501;
      const tmpDir = await makeTempDir("daisyclaw-restart-helper-");
      const fakeBinDir = path.join(tmpDir, "bin");
      const stateFile = path.join(tmpDir, "state-file");
      const markerPath = path.join(tmpDir, "launchctl-ran");
      await fs.mkdir(fakeBinDir, { recursive: true });
      await writeFakeSleep(fakeBinDir);
      await fs.writeFile(stateFile, "not a directory");
      await writeFakeLaunchctl(
        fakeBinDir,
        `#!/bin/sh
printf ran > "$LAUNCHCTL_MARKER"
exit 0
`,
      );

      const { scriptPath } = await prepareAndReadScript({
        DAISYCLAW_PROFILE: "default",
        HOME: path.join(tmpDir, "home"),
        DAISYCLAW_STATE_DIR: stateFile,
      });

      const result = await executeScript(scriptPath, {
        LAUNCHCTL_MARKER: markerPath,
        PATH: `${fakeBinDir}:${process.env.PATH ?? ""}`,
      });

      expect(result.code).toBeNull();
      await expect(fs.readFile(markerPath, "utf-8")).resolves.toBe("ran");
    });

    it("logs custom macOS launchd labels without shell expansion", async () => {
      Object.defineProperty(process, "platform", { value: "darwin" });
      process.getuid = () => 501;
      const tmpDir = await makeTempDir("daisyclaw-restart-helper-");
      const fakeBinDir = path.join(tmpDir, "bin");
      const stateDir = path.join(tmpDir, "state");
      await fs.mkdir(fakeBinDir, { recursive: true });
      await writeFakeSleep(fakeBinDir);
      await writeFakeLaunchctl(fakeBinDir);

      const { scriptPath } = await prepareAndReadScript({
        DAISYCLAW_LAUNCHD_LABEL: "ai.daisyclaw.$(echo injected)",
        HOME: path.join(tmpDir, "home"),
        DAISYCLAW_STATE_DIR: stateDir,
      });

      const result = await executeScript(scriptPath, {
        PATH: `${fakeBinDir}:${process.env.PATH ?? ""}`,
      });
      const log = await fs.readFile(path.join(stateDir, "logs", "gateway-restart.log"), "utf-8");

      expect(result.code).toBeNull();
      expect(log).toContain("target=ai.daisyclaw.$(echo injected)");
      expect(log).not.toContain("target=ai.daisyclaw.injected");
    });

    it("uses DAISYCLAW_LAUNCHD_LABEL override on macOS", async () => {
      Object.defineProperty(process, "platform", { value: "darwin" });
      process.getuid = () => 501;

      const { scriptPath, content } = await prepareAndReadScript({
        DAISYCLAW_PROFILE: "default",
        DAISYCLAW_LAUNCHD_LABEL: "com.custom.daisyclaw",
      });
      expect(content).toContain("launchctl kickstart -k 'gui/501/com.custom.daisyclaw'");
      await cleanupScript(scriptPath);
    });

    it("creates a guarded schtasks restart script on Windows", async () => {
      Object.defineProperty(process, "platform", { value: "win32" });

      const { scriptPath, content } = await prepareAndReadScript({
        DAISYCLAW_PROFILE: "default",
      });
      expect(scriptPath.endsWith(".cmd")).toBe(true);
      expect(content).toContain("@echo off");
      expect(content).toContain("powershell -NoProfile -ExecutionPolicy Bypass -Command");
      expect(content).not.toContain("powershell -NoProfile -ExecutionPolicy Bypass -File");
      expect(content).toContain('$ErrorActionPreference = "Continue"');
      expect(content).toContain("gateway-restart.log");
      expect(content).toContain("$taskName = 'DaisyClaw Gateway'");
      expect(content).toContain("function Invoke-DaisyClawSchtasksWithTimeout");
      expect(content).toContain("function Get-DaisyClawScheduledTaskState");
      expect(content).toContain("function Invoke-DaisyClawStartupLauncher");
      expect(content).toContain("Get-ScheduledTask -TaskName $TaskName");
      expect(content).toContain("daisyclaw restart skipped schtasks end");
      expect(content).toContain(
        '$launcherPath = Join-Path $env:USERPROFILE ".daisyclaw\\gateway.cmd"',
      );
      expect(content).toContain("daisyclaw restart launched startup fallback");
      expectWindowsRestartWaitOrdering(content);
      expect(content).toContain('del "%~f0" >nul 2>&1');
      expect(content).toContain('rmdir "%DAISYCLAW_RESTART_SCRIPT_DIR%" >nul 2>&1');
      await cleanupScript(scriptPath);
    });

    it("uses DAISYCLAW_WINDOWS_TASK_NAME override on Windows", async () => {
      Object.defineProperty(process, "platform", { value: "win32" });

      const { scriptPath, content } = await prepareAndReadScript({
        DAISYCLAW_PROFILE: "default",
        DAISYCLAW_WINDOWS_TASK_NAME: "DaisyClaw Gateway (custom)",
      });
      expect(content).toContain("$taskName = 'DaisyClaw Gateway (custom)'");
      expect(content).toContain("Get-DaisyClawScheduledTaskState -TaskName $taskName");
      expect(content).toContain(
        'Invoke-DaisyClawSchtasksWithTimeout -Arguments @("/End", "/TN", $taskName) -TimeoutSeconds 10',
      );
      expect(content).toContain("$status = Invoke-DaisyClawStartupLauncher");
      expectWindowsRestartWaitOrdering(content);
      await cleanupScript(scriptPath);
    });

    it("uses passed gateway port for port polling on Windows", async () => {
      Object.defineProperty(process, "platform", { value: "win32" });
      const customPort = 9999;

      const { scriptPath, content } = await prepareAndReadScript(
        {
          DAISYCLAW_PROFILE: "default",
        },
        customPort,
      );
      expect(content).toContain(`$port = ${customPort}`);
      expect(content).toContain("Get-NetTCPConnection -LocalPort $Port -State Listen");
      expect(content).toContain("& netstat.exe -ano -p tcp");
      expect(content).not.toContain("findstr");
      expectWindowsRestartWaitOrdering(content, customPort);
      await cleanupScript(scriptPath);
    });

    it("uses custom profile in service names", async () => {
      Object.defineProperty(process, "platform", { value: "linux" });
      const { scriptPath, content } = await prepareAndReadScript({
        DAISYCLAW_PROFILE: "production",
      });
      expect(content).toContain("daisyclaw-gateway-production.service");
      await cleanupScript(scriptPath);
    });

    it("uses custom profile in macOS launchd label", async () => {
      Object.defineProperty(process, "platform", { value: "darwin" });
      process.getuid = () => 502;

      const { scriptPath, content } = await prepareAndReadScript({
        DAISYCLAW_PROFILE: "staging",
      });
      expect(content).toContain("gui/502/ai.daisyclaw.staging");
      await cleanupScript(scriptPath);
    });

    it("uses custom profile in Windows task name", async () => {
      Object.defineProperty(process, "platform", { value: "win32" });

      const { scriptPath, content } = await prepareAndReadScript({
        DAISYCLAW_PROFILE: "production",
      });
      expect(content).toContain("$taskName = 'DaisyClaw Gateway (production)'");
      expectWindowsRestartWaitOrdering(content);
      await cleanupScript(scriptPath);
    });

    it("returns null for unsupported platforms", async () => {
      Object.defineProperty(process, "platform", { value: "aix" });
      const scriptPath = await prepareRestartScript({});
      expect(scriptPath).toBeNull();
    });

    it("returns null when script creation fails", async () => {
      Object.defineProperty(process, "platform", { value: "linux" });
      const writeFileSpy = vi
        .spyOn(fs, "writeFile")
        .mockRejectedValueOnce(new Error("simulated write failure"));

      const scriptPath = await prepareRestartScript({
        DAISYCLAW_PROFILE: "default",
      });

      expect(scriptPath).toBeNull();
      writeFileSpy.mockRestore();
    });

    it("escapes single quotes in profile names for shell scripts", async () => {
      Object.defineProperty(process, "platform", { value: "linux" });
      const { scriptPath, content } = await prepareAndReadScript({
        DAISYCLAW_PROFILE: "it's-a-test",
      });
      // Single quotes should be escaped with '\'' pattern
      expect(content).not.toContain("it's");
      expect(content).toContain("it'\\''s");
      await cleanupScript(scriptPath);
    });

    it("expands HOME in plist path instead of leaving literal $HOME", async () => {
      Object.defineProperty(process, "platform", { value: "darwin" });
      process.getuid = () => 501;

      const { scriptPath, content } = await prepareAndReadScript({
        HOME: "/Users/testuser",
        DAISYCLAW_PROFILE: "default",
      });
      // The plist path must contain the resolved home dir, not literal $HOME
      expect(content).toMatch(/[\\/]Users[\\/]testuser[\\/]Library[\\/]LaunchAgents[\\/]/);
      expect(content).not.toContain("$HOME");
      await cleanupScript(scriptPath);
    });

    it("prefers env parameter HOME over process.env.HOME for plist path", async () => {
      Object.defineProperty(process, "platform", { value: "darwin" });
      process.getuid = () => 502;

      const { scriptPath, content } = await prepareAndReadScript({
        HOME: "/Users/envhome",
        DAISYCLAW_PROFILE: "default",
      });
      expect(content).toMatch(/[\\/]Users[\\/]envhome[\\/]Library[\\/]LaunchAgents[\\/]/);
      await cleanupScript(scriptPath);
    });

    it("shell-escapes the label in the plist path on macOS", async () => {
      Object.defineProperty(process, "platform", { value: "darwin" });
      process.getuid = () => 501;

      const { scriptPath, content } = await prepareAndReadScript({
        HOME: "/Users/testuser",
        DAISYCLAW_LAUNCHD_LABEL: "ai.daisyclaw.it's-a-test",
      });
      // The plist path must also shell-escape the label to prevent injection
      expect(content).toContain("ai.daisyclaw.it'\\''s-a-test.plist");
      await cleanupScript(scriptPath);
    });

    it("rejects unsafe batch profile names on Windows", async () => {
      Object.defineProperty(process, "platform", { value: "win32" });
      const scriptPath = await prepareRestartScript({
        DAISYCLAW_PROFILE: "test&whoami",
      });

      expect(scriptPath).toBeNull();
    });
  });

  describe("runRestartScript", () => {
    it("spawns the script as a detached process on Linux", async () => {
      Object.defineProperty(process, "platform", { value: "linux" });
      const scriptPath = "/tmp/fake-script.sh";
      const mockChild = { on: vi.fn(), unref: vi.fn() };
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ChildProcess);

      await runRestartScript(scriptPath);

      expect(spawn).toHaveBeenCalledWith("/bin/sh", [scriptPath], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
      expect(mockChild.on).toHaveBeenCalledWith("error", expect.any(Function));
      expect(mockChild.unref).toHaveBeenCalledTimes(1);
    });

    it("uses cmd.exe on Windows", async () => {
      Object.defineProperty(process, "platform", { value: "win32" });
      const scriptPath = "C:\\Temp\\fake-script.bat";
      const mockChild = { on: vi.fn(), unref: vi.fn() };
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ChildProcess);

      await runRestartScript(scriptPath);

      expect(spawn).toHaveBeenCalledWith("cmd.exe", ["/d", "/s", "/c", scriptPath], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
      expect(mockChild.on).toHaveBeenCalledWith("error", expect.any(Function));
      expect(mockChild.unref).toHaveBeenCalledTimes(1);
    });

    it("quotes cmd.exe /c paths with metacharacters on Windows", async () => {
      Object.defineProperty(process, "platform", { value: "win32" });
      const scriptPath = "C:\\Temp\\me&(ow)\\fake-script.bat";
      const mockChild = { on: vi.fn(), unref: vi.fn() };
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ChildProcess);

      await runRestartScript(scriptPath);

      expect(spawn).toHaveBeenCalledWith("cmd.exe", ["/d", "/s", "/c", `"${scriptPath}"`], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
    });

    it("does not throw when spawn fails synchronously", async () => {
      Object.defineProperty(process, "platform", { value: "linux" });
      vi.mocked(spawn).mockImplementation(() => {
        throw Object.assign(new Error("spawn /bin/sh ENOENT"), { code: "ENOENT" });
      });

      await expect(runRestartScript("/tmp/fake-script.sh")).resolves.toBeUndefined();
    });

    it("handles child process spawn errors after the detached handoff", async () => {
      Object.defineProperty(process, "platform", { value: "linux" });
      let errorHandler: ((error: Error) => void) | undefined;
      const mockChild = {
        on: vi.fn((event: string, handler: (error: Error) => void) => {
          if (event === "error") {
            errorHandler = handler;
          }
          return mockChild;
        }),
        unref: vi.fn(),
      };
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ChildProcess);

      await runRestartScript("/tmp/fake-script.sh");
      expect(errorHandler).toBeDefined();
      expect(() => errorHandler?.(new Error("spawn /bin/sh ENOENT"))).not.toThrow();
    });
  });
});
