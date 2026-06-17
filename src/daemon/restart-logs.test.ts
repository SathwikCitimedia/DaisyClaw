// Daemon restart log tests cover restart log formatting and filtering.
import { describe, expect, it } from "vitest";
import {
  GATEWAY_RESTART_LOG_FILENAME,
  renderCmdRestartLogSetup,
  renderPosixRestartLogSetup,
  resolveGatewayLogPaths,
  resolveGatewayRestartLogPath,
  resolveGatewaySupervisorLogPaths,
} from "./restart-logs.js";

describe("restart log conventions", () => {
  it("resolves profile-aware gateway logs and restart attempts together", () => {
    const env = {
      HOME: "/Users/test",
      DAISYCLAW_PROFILE: "work",
    };

    expect(resolveGatewayLogPaths(env)).toEqual({
      logDir: "/Users/test/.daisyclaw-work/logs",
      stdoutPath: "/Users/test/.daisyclaw-work/logs/gateway.log",
      stderrPath: "/Users/test/.daisyclaw-work/logs/gateway.err.log",
    });
    expect(resolveGatewayRestartLogPath(env)).toBe(
      `/Users/test/.daisyclaw-work/logs/${GATEWAY_RESTART_LOG_FILENAME}`,
    );
  });

  it("honors DAISYCLAW_STATE_DIR for restart attempts", () => {
    const env = {
      HOME: "/Users/test",
      DAISYCLAW_STATE_DIR: "/tmp/daisyclaw-state",
    };

    expect(resolveGatewayRestartLogPath(env)).toBe(
      `/tmp/daisyclaw-state/logs/${GATEWAY_RESTART_LOG_FILENAME}`,
    );
  });

  it("keeps macOS LaunchAgent stdout outside the state directory", () => {
    const env = {
      HOME: "/Users/test",
      DAISYCLAW_STATE_DIR: "/Volumes/External/daisyclaw",
    };

    expect(resolveGatewaySupervisorLogPaths(env, { platform: "darwin" })).toEqual({
      logDir: "/Users/test/Library/Logs/daisyclaw",
      stdoutPath: "/Users/test/Library/Logs/daisyclaw/gateway.log",
      stderrPath: "/Users/test/Library/Logs/daisyclaw/gateway.err.log",
    });
    expect(resolveGatewayRestartLogPath(env)).toBe(
      `/Volumes/External/daisyclaw/logs/${GATEWAY_RESTART_LOG_FILENAME}`,
    );
  });

  it("keeps macOS LaunchAgent logs profile-aware in the shared user log directory", () => {
    const env = {
      HOME: "/Users/test",
      DAISYCLAW_PROFILE: "work",
    };

    expect(resolveGatewaySupervisorLogPaths(env, { platform: "darwin" })).toEqual({
      logDir: "/Users/test/Library/Logs/daisyclaw",
      stdoutPath: "/Users/test/Library/Logs/daisyclaw/gateway-work.log",
      stderrPath: "/Users/test/Library/Logs/daisyclaw/gateway-work.err.log",
    });
  });

  it("renders best-effort POSIX log setup with escaped paths", () => {
    const setup = renderPosixRestartLogSetup({
      HOME: "/Users/test's",
    });

    expect(setup).toContain(
      "if mkdir -p '/Users/test'\\''s/.daisyclaw/logs' 2>/dev/null && : >>'/Users/test'\\''s/.daisyclaw/logs/gateway-restart.log' 2>/dev/null; then",
    );
    expect(setup).toContain("exec >>'/Users/test'\\''s/.daisyclaw/logs/gateway-restart.log' 2>&1");
  });

  it("renders CMD log setup with quoted paths", () => {
    const setup = renderCmdRestartLogSetup({
      USERPROFILE: "C:\\Users\\Test User",
    });

    expect(setup.quotedLogPath).toBe('"C:\\Users\\Test User/.daisyclaw/logs/gateway-restart.log"');
    expect(setup.lines).toContain(
      'if not exist "C:\\Users\\Test User/.daisyclaw/logs" mkdir "C:\\Users\\Test User/.daisyclaw/logs" >nul 2>&1',
    );
  });
});
