// Relaunches the gateway through the managed Windows scheduled task.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { quoteCmdScriptArg } from "../daemon/cmd-argv.js";
import { resolveGatewayWindowsTaskName } from "../daemon/constants.js";
import { renderCmdRestartLogSetup } from "../daemon/restart-logs.js";
import { resolveTaskScriptPath } from "../daemon/schtasks.js";
import { formatErrorMessage } from "./errors.js";
import type { RestartAttempt } from "./restart.types.js";
import { resolvePreferredDaisyClawTmpDir } from "./tmp-daisyclaw-dir.js";

const TASK_RESTART_RETRY_LIMIT = 12;
const TASK_RESTART_RETRY_DELAY_SEC = 1;

function quotePowerShellSingleQuotedLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function resolveWindowsTaskName(env: NodeJS.ProcessEnv): string {
  const override = env.DAISYCLAW_WINDOWS_TASK_NAME?.trim();
  if (override) {
    return override;
  }
  return resolveGatewayWindowsTaskName(env.DAISYCLAW_PROFILE);
}

function buildScheduledTaskRestartScript(params: {
  quotedLogPath: string;
  setupLines: string[];
  taskName: string;
  taskScriptPath?: string;
}): string {
  const { quotedLogPath, setupLines, taskName, taskScriptPath } = params;
  const quotedTaskName = quoteCmdScriptArg(taskName);
  // One PowerShell process that answers through its exit code. The previous
  // form piped the task state into `findstr /I /C:"Running"`; a pipeline in a
  // console-less cmd.exe made Windows open a console window for the two
  // children, titled with that findstr command, in the user's face during
  // every restart.
  const queryTaskStateCommand = `if ((Get-ScheduledTask -TaskName ${quotePowerShellSingleQuotedLiteral(
    taskName,
  )} -ErrorAction SilentlyContinue).State -eq 'Running') { exit 0 }; exit 1`;
  const quotedQueryTaskStateCommand = quoteCmdScriptArg(queryTaskStateCommand);
  const lines = [
    "@echo off",
    "setlocal",
    ...setupLines,
    `>> ${quotedLogPath} 2>&1 echo [%DATE% %TIME%] daisyclaw restart attempt source=windows-task-handoff target=${quotedTaskName}`,
    `schtasks /Query /TN ${quotedTaskName} >> ${quotedLogPath} 2>&1`,
    "if errorlevel 1 goto fallback",
    "set /a attempts=0",
    ":retry",
    `timeout /t ${TASK_RESTART_RETRY_DELAY_SEC} /nobreak >nul`,
    "set /a attempts+=1",
    // Avoid racing with another restart path that already started the scheduled task.
    `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command ${quotedQueryTaskStateCommand} >nul 2>&1`,
    "if not errorlevel 1 goto cleanup",
    `schtasks /Run /TN ${quotedTaskName} >> ${quotedLogPath} 2>&1`,
    "if not errorlevel 1 goto cleanup",
    `if %attempts% GEQ ${TASK_RESTART_RETRY_LIMIT} goto fallback`,
    "goto retry",
    ":fallback",
    `>> ${quotedLogPath} 2>&1 echo [%DATE% %TIME%] daisyclaw restart fallback source=windows-task-handoff`,
  ];
  if (taskScriptPath) {
    const quotedScript = quoteCmdScriptArg(taskScriptPath);
    lines.push(`if exist ${quotedScript} (`, `  start "" /min cmd.exe /d /c ${quotedScript}`, ")");
  }
  lines.push(
    ":cleanup",
    `>> ${quotedLogPath} 2>&1 echo [%DATE% %TIME%] daisyclaw restart finished source=windows-task-handoff`,
    'del "%~f0" >nul 2>&1',
  );
  return lines.join("\r\n");
}

export function relaunchGatewayScheduledTask(env: NodeJS.ProcessEnv = process.env): RestartAttempt {
  const taskName = resolveWindowsTaskName(env);
  const taskScriptPath = resolveTaskScriptPath(env);
  const scriptPath = path.join(
    resolvePreferredDaisyClawTmpDir(),
    `daisyclaw-schtasks-restart-${randomUUID()}.cmd`,
  );
  const quotedScriptPath = quoteCmdScriptArg(scriptPath);
  const restartLog = renderCmdRestartLogSetup({ ...process.env, ...env });
  try {
    fs.writeFileSync(
      scriptPath,
      `${buildScheduledTaskRestartScript({
        quotedLogPath: restartLog.quotedLogPath,
        setupLines: restartLog.lines,
        taskName,
        taskScriptPath,
      })}\r\n`,
      "utf8",
    );
    // Hidden, not detached. `detached` maps to DETACHED_PROCESS, which gives
    // cmd.exe no console at all; every console program the script then runs
    // (powershell, schtasks) gets a brand-new *visible* console window from
    // Windows. `windowsHide` alone maps to CREATE_NO_WINDOW: cmd.exe owns a
    // hidden console and its children inherit it. Outliving the gateway does
    // not need `detached` on Windows (children are not killed with their
    // parent, and libuv never used a job breakaway here anyway); `unref` keeps
    // this process from waiting on the helper.
    const child = spawn("cmd.exe", ["/d", "/s", "/c", quotedScriptPath], {
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
    return {
      ok: true,
      method: "schtasks",
      tried: [`schtasks /Run /TN "${taskName}"`, `cmd.exe /d /s /c ${quotedScriptPath}`],
    };
  } catch (err) {
    try {
      fs.unlinkSync(scriptPath);
    } catch {
      // Best-effort cleanup; keep the original restart failure.
    }
    return {
      ok: false,
      method: "schtasks",
      detail: formatErrorMessage(err),
      tried: [`schtasks /Run /TN "${taskName}"`],
    };
  }
}
