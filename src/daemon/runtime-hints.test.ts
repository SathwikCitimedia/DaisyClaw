// Daemon runtime hint tests cover platform-specific daemon guidance.
import { describe, expect, it } from "vitest";
import { buildPlatformRuntimeLogHints, buildPlatformServiceStartHints } from "./runtime-hints.js";

describe("buildPlatformRuntimeLogHints", () => {
  it("renders launchd log hints on darwin", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "darwin",
        env: {
          HOME: "/Users/test",
          DAISYCLAW_STATE_DIR: "/tmp/daisyclaw-state",
          DAISYCLAW_LOG_PREFIX: "gateway",
        },
        systemdServiceName: "daisyclaw-gateway",
        windowsTaskName: "DaisyClaw Gateway",
      }),
    ).toEqual([
      "Launchd stdout (if installed): /Users/test/Library/Logs/daisyclaw/gateway.log",
      "Launchd stderr (if installed): suppressed",
      "Restart attempts: /tmp/daisyclaw-state/logs/gateway-restart.log",
    ]);
  });

  it("renders systemd and windows hints by platform", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "linux",
        env: {
          DAISYCLAW_STATE_DIR: "/tmp/daisyclaw-state",
        },
        systemdServiceName: "daisyclaw-gateway",
        windowsTaskName: "DaisyClaw Gateway",
      }),
    ).toEqual([
      "Logs: journalctl --user -u daisyclaw-gateway.service -n 200 --no-pager",
      "Restart attempts: /tmp/daisyclaw-state/logs/gateway-restart.log",
    ]);
    expect(
      buildPlatformRuntimeLogHints({
        platform: "win32",
        env: {
          DAISYCLAW_STATE_DIR: "/tmp/daisyclaw-state",
        },
        systemdServiceName: "daisyclaw-gateway",
        windowsTaskName: "DaisyClaw Gateway",
      }),
    ).toEqual([
      'Logs: schtasks /Query /TN "DaisyClaw Gateway" /V /FO LIST',
      "Restart attempts: /tmp/daisyclaw-state/logs/gateway-restart.log",
    ]);
  });
});

describe("buildPlatformServiceStartHints", () => {
  it("builds platform-specific service start hints", () => {
    expect(
      buildPlatformServiceStartHints({
        platform: "darwin",
        installCommand: "daisyclaw gateway install",
        startCommand: "daisyclaw gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/com.daisyclaw.gateway.plist",
        systemdServiceName: "daisyclaw-gateway",
        windowsTaskName: "DaisyClaw Gateway",
      }),
    ).toEqual([
      "daisyclaw gateway install",
      "daisyclaw gateway",
      "launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.daisyclaw.gateway.plist",
    ]);
    expect(
      buildPlatformServiceStartHints({
        platform: "linux",
        installCommand: "daisyclaw gateway install",
        startCommand: "daisyclaw gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/com.daisyclaw.gateway.plist",
        systemdServiceName: "daisyclaw-gateway",
        windowsTaskName: "DaisyClaw Gateway",
      }),
    ).toEqual([
      "daisyclaw gateway install",
      "daisyclaw gateway",
      "systemctl --user start daisyclaw-gateway.service",
    ]);
  });
});
