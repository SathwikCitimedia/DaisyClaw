// Preaction tests cover CLI preaction hooks and command context setup.
import { Command } from "commander";
import { repoInstallSpec } from "daisyclaw/plugin-sdk/test-fixtures";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { loggingState } from "../../logging/state.js";
import { setCommandJsonMode } from "./json-mode.js";
import { applyParentDefaultHelpAction } from "./parent-default-help.js";

const DISCORD_REPO_INSTALL_SPEC = repoInstallSpec("discord");

const setVerboseMock = vi.fn();
const emitCliBannerMock = vi.fn();
const ensureConfigReadyMock = vi.fn(async () => {});
const ensurePluginRegistryLoadedMock = vi.fn();
const routeLogsToStderrMock = vi.fn();

const runtimeMock = {
  log: vi.fn(),
  error: vi.fn(),
  writeStdout: vi.fn(),
  writeJson: vi.fn(),
  exit: vi.fn(),
};

vi.mock("../../globals.js", () => ({
  setVerbose: setVerboseMock,
}));

vi.mock("../../runtime.js", () => ({
  defaultRuntime: runtimeMock,
}));

vi.mock("../banner.js", () => ({
  emitCliBanner: emitCliBannerMock,
}));

vi.mock("../../logging/console.js", () => ({
  routeLogsToStderr: routeLogsToStderrMock,
}));

vi.mock("../cli-name.js", () => ({
  resolveCliName: () => "daisyclaw",
}));

vi.mock("./config-guard.js", () => ({
  ensureConfigReady: ensureConfigReadyMock,
}));

vi.mock("../plugin-registry.js", () => ({
  ensurePluginRegistryLoaded: ensurePluginRegistryLoadedMock,
}));

let registerPreActionHooks: typeof import("./preaction.js").registerPreActionHooks;
let originalProcessArgv: string[];
let originalProcessTitle: string;
let originalProcessTitleDescriptor: PropertyDescriptor | undefined;
let observedProcessTitle: string;
let originalNodeNoWarnings: string | undefined;
let originalHideBanner: string | undefined;
let originalForceStderr: boolean;

beforeAll(async () => {
  ({ registerPreActionHooks } = await import("./preaction.js"));
});

beforeEach(() => {
  vi.clearAllMocks();
  originalProcessArgv = [...process.argv];
  originalProcessTitle = process.title;
  originalProcessTitleDescriptor = Object.getOwnPropertyDescriptor(process, "title");
  observedProcessTitle = originalProcessTitle;
  originalNodeNoWarnings = process.env.NODE_NO_WARNINGS;
  originalHideBanner = process.env.DAISYCLAW_HIDE_BANNER;
  originalForceStderr = loggingState.forceConsoleToStderr;
  // Worker-thread Vitest runs do not reliably mutate the real process title,
  // so capture writes at the property boundary instead.
  Object.defineProperty(process, "title", {
    configurable: true,
    enumerable: originalProcessTitleDescriptor?.enumerable ?? true,
    get: () => observedProcessTitle,
    set: (value: string) => {
      observedProcessTitle = value;
    },
  });
  loggingState.forceConsoleToStderr = false;
  delete process.env.NODE_NO_WARNINGS;
  delete process.env.DAISYCLAW_HIDE_BANNER;
});

afterEach(() => {
  process.argv = originalProcessArgv;
  if (originalProcessTitleDescriptor && "value" in originalProcessTitleDescriptor) {
    Object.defineProperty(process, "title", {
      ...originalProcessTitleDescriptor,
      value: originalProcessTitle,
    });
  } else if (originalProcessTitleDescriptor) {
    Object.defineProperty(process, "title", originalProcessTitleDescriptor);
  } else {
    process.title = originalProcessTitle;
  }
  loggingState.forceConsoleToStderr = originalForceStderr;
  if (originalNodeNoWarnings === undefined) {
    delete process.env.NODE_NO_WARNINGS;
  } else {
    process.env.NODE_NO_WARNINGS = originalNodeNoWarnings;
  }
  if (originalHideBanner === undefined) {
    delete process.env.DAISYCLAW_HIDE_BANNER;
  } else {
    process.env.DAISYCLAW_HIDE_BANNER = originalHideBanner;
  }
});

describe("registerPreActionHooks", () => {
  let program: Command;
  let preActionHook:
    | ((thisCommand: Command, actionCommand: Command) => Promise<void> | void)
    | null = null;

  function buildProgram() {
    const programLocal = new Command().name("daisyclaw");
    programLocal
      .command("agent")
      .requiredOption("-m, --message <text>")
      .option("--local")
      .option("--json")
      .action(() => {});
    programLocal
      .command("status")
      .option("--json")
      .action(() => {});
    programLocal
      .command("backup")
      .command("create")
      .option("--json")
      .action(() => {});
    programLocal
      .command("doctor")
      .option("--lint")
      .action(() => {});
    programLocal.command("completion").action(() => {});
    programLocal.command("secrets").action(() => {});
    programLocal
      .command("agents")
      .command("list")
      .option("--json")
      .action(() => {});
    programLocal.command("configure").action(() => {});
    programLocal.command("onboard").action(() => {});
    const channels = programLocal.command("channels");
    channels.command("add").action(() => {});
    channels
      .command("send")
      .option("--json")
      .action(() => {});
    applyParentDefaultHelpAction(channels);
    programLocal
      .command("plugins")
      .command("install")
      .argument("<spec>")
      .option("--marketplace <marketplace>")
      .action(() => {});
    programLocal
      .command("update")
      .command("status")
      .option("--json")
      .action(() => {});
    programLocal
      .command("message")
      .command("send")
      .option("--json")
      .action(() => {});
    const config = programLocal.command("config");
    config.option("--section <section>");
    setCommandJsonMode(config.command("set"), "parse-only")
      .argument("<path>")
      .argument("<value>")
      .option("--json")
      .action(() => {});
    config
      .command("validate")
      .option("--json")
      .action(() => {});
    config.command("schema").action(() => {});
    registerPreActionHooks(programLocal, "9.9.9-test");
    return programLocal;
  }

  function resolveActionCommand(parseArgv: string[]): Command {
    let current = program;
    for (const segment of parseArgv) {
      const next = current.commands.find((command) => command.name() === segment);
      if (!next) {
        break;
      }
      current = next;
    }
    return current;
  }

  async function runPreAction(params: { parseArgv: string[]; processArgv?: string[] }) {
    process.argv = params.processArgv ?? [...params.parseArgv];
    const actionCommand = resolveActionCommand(params.parseArgv);
    if (!preActionHook) {
      throw new Error("missing preAction hook");
    }
    await preActionHook(program, actionCommand);
  }

  it("handles debug mode and config-only command preaction", async () => {
    const processTitleSetSpy = vi.spyOn(process, "title", "set");
    await runPreAction({
      parseArgv: ["status"],
      processArgv: ["node", "daisyclaw", "status", "--debug"],
    });

    expect(emitCliBannerMock).toHaveBeenCalledWith("9.9.9-test");
    expect(setVerboseMock).toHaveBeenCalledWith(true);
    expect(ensureConfigReadyMock).toHaveBeenCalledWith({
      runtime: runtimeMock,
      commandPath: ["status"],
    });
    expect(ensurePluginRegistryLoadedMock).not.toHaveBeenCalled();
    expect(processTitleSetSpy).toHaveBeenCalledWith("daisyclaw-status");

    vi.clearAllMocks();
    await runPreAction({
      parseArgv: ["agents", "list"],
      processArgv: ["node", "daisyclaw", "agents", "list"],
    });

    expect(setVerboseMock).toHaveBeenCalledWith(false);
    expect(process.env.NODE_NO_WARNINGS).toBe("1");
    expect(ensureConfigReadyMock).toHaveBeenCalledWith({
      runtime: runtimeMock,
      commandPath: ["agents", "list"],
    });
    expect(ensurePluginRegistryLoadedMock).not.toHaveBeenCalled();
    processTitleSetSpy.mockRestore();
  });

  it("loads plugins for text local agent runs", async () => {
    await runPreAction({
      parseArgv: ["agent"],
      processArgv: ["node", "daisyclaw", "agent", "--local", "--message", "hi"],
    });

    expect(ensureConfigReadyMock).toHaveBeenCalledWith({
      runtime: runtimeMock,
      commandPath: ["agent", "hi"],
    });
    expect(ensurePluginRegistryLoadedMock).toHaveBeenCalledWith({
      scope: "all",
    });
  });

  it("loads plugins for json local agent runs", async () => {
    await runPreAction({
      parseArgv: ["agent"],
      processArgv: ["node", "daisyclaw", "agent", "--local", "--message", "hi", "--json"],
    });

    expect(ensureConfigReadyMock).toHaveBeenCalledWith({
      runtime: runtimeMock,
      commandPath: ["agent", "hi"],
      suppressDoctorStdout: true,
    });
    expect(ensurePluginRegistryLoadedMock).toHaveBeenCalledWith({
      scope: "all",
    });
  });

  it("keeps setup alias and channels add manifest-first", async () => {
    await runPreAction({
      parseArgv: ["onboard"],
      processArgv: ["node", "daisyclaw", "onboard"],
    });

    expect(ensureConfigReadyMock).toHaveBeenCalledWith({
      runtime: runtimeMock,
      commandPath: ["onboard"],
    });
    expect(ensurePluginRegistryLoadedMock).not.toHaveBeenCalled();

    vi.clearAllMocks();
    await runPreAction({
      parseArgv: ["channels", "add"],
      processArgv: ["node", "daisyclaw", "channels", "add"],
    });

    expect(ensureConfigReadyMock).toHaveBeenCalledWith({
      runtime: runtimeMock,
      commandPath: ["channels", "add"],
    });
    expect(ensurePluginRegistryLoadedMock).not.toHaveBeenCalled();
  });

  it("skips startup bootstrap for parent default help actions", async () => {
    await runPreAction({
      parseArgv: ["channels"],
      processArgv: ["node", "daisyclaw", "channels"],
    });

    expect(emitCliBannerMock).not.toHaveBeenCalled();
    expect(setVerboseMock).not.toHaveBeenCalled();
    expect(ensureConfigReadyMock).not.toHaveBeenCalled();
    expect(ensurePluginRegistryLoadedMock).not.toHaveBeenCalled();
  });

  it("lets configure own config validation and plugin loading", async () => {
    await runPreAction({
      parseArgv: ["configure"],
      processArgv: ["node", "daisyclaw", "configure"],
    });

    expect(ensureConfigReadyMock).not.toHaveBeenCalled();
    expect(ensurePluginRegistryLoadedMock).not.toHaveBeenCalled();
  });

  it("lets bare config own config validation and plugin loading", async () => {
    await runPreAction({
      parseArgv: ["config"],
      processArgv: ["node", "daisyclaw", "config"],
    });

    expect(ensureConfigReadyMock).not.toHaveBeenCalled();
    expect(ensurePluginRegistryLoadedMock).not.toHaveBeenCalled();
  });

  it("lets guided config sections own config validation and plugin loading", async () => {
    await runPreAction({
      parseArgv: ["config"],
      processArgv: ["node", "daisyclaw", "config", "--section", "models"],
    });

    expect(ensureConfigReadyMock).not.toHaveBeenCalled();
    expect(ensurePluginRegistryLoadedMock).not.toHaveBeenCalled();
  });

  it("skips the config guard and plugin loading for doctor lint", async () => {
    await runPreAction({
      parseArgv: ["doctor"],
      processArgv: ["node", "daisyclaw", "doctor", "--lint"],
    });

    expect(ensureConfigReadyMock).not.toHaveBeenCalled();
    expect(ensurePluginRegistryLoadedMock).not.toHaveBeenCalled();
  });

  it("only allows invalid config for explicit official recovery reinstall requests", async () => {
    await runPreAction({
      parseArgv: ["plugins", "install", "@daisyclaw/discord"],
      processArgv: ["node", "daisyclaw", "plugins", "install", "@daisyclaw/discord"],
    });

    expect(ensureConfigReadyMock).toHaveBeenCalledWith({
      runtime: runtimeMock,
      commandPath: ["plugins", "install"],
      allowInvalid: true,
    });

    vi.clearAllMocks();
    await runPreAction({
      parseArgv: ["plugins", "install", "@daisyclaw/brave-plugin"],
      processArgv: ["node", "daisyclaw", "plugins", "install", "@daisyclaw/brave-plugin"],
    });

    expect(ensureConfigReadyMock).toHaveBeenCalledWith({
      runtime: runtimeMock,
      commandPath: ["plugins", "install"],
      allowInvalid: true,
    });

    vi.clearAllMocks();
    await runPreAction({
      parseArgv: ["plugins", "install", "@daisyclaw/slack"],
      processArgv: ["node", "daisyclaw", "plugins", "install", "@daisyclaw/slack"],
    });

    expect(ensureConfigReadyMock).toHaveBeenCalledWith({
      runtime: runtimeMock,
      commandPath: ["plugins", "install"],
      allowInvalid: true,
    });

    vi.clearAllMocks();
    await runPreAction({
      parseArgv: ["plugins", "install", "alpha"],
      processArgv: ["node", "daisyclaw", "plugins", "install", "alpha"],
    });

    expect(ensureConfigReadyMock).toHaveBeenCalledWith({
      runtime: runtimeMock,
      commandPath: ["plugins", "install"],
    });

    vi.clearAllMocks();
    await runPreAction({
      parseArgv: ["plugins", "install", DISCORD_REPO_INSTALL_SPEC],
      processArgv: ["node", "daisyclaw", "plugins", "install", DISCORD_REPO_INSTALL_SPEC],
    });

    expect(ensureConfigReadyMock).toHaveBeenCalledWith({
      runtime: runtimeMock,
      commandPath: ["plugins", "install"],
      allowInvalid: true,
    });

    vi.clearAllMocks();
    await runPreAction({
      parseArgv: ["plugins", "install", "@daisyclaw/discord", "--marketplace", "local/repo"],
      processArgv: [
        "node",
        "daisyclaw",
        "plugins",
        "install",
        "@daisyclaw/discord",
        "--marketplace",
        "local/repo",
      ],
    });

    expect(ensureConfigReadyMock).toHaveBeenCalledWith({
      runtime: runtimeMock,
      commandPath: ["plugins", "install"],
    });
  });

  it("skips help/version preaction and respects banner opt-out", async () => {
    await runPreAction({
      parseArgv: ["status"],
      processArgv: ["node", "daisyclaw", "--version"],
    });

    expect(emitCliBannerMock).not.toHaveBeenCalled();
    expect(setVerboseMock).not.toHaveBeenCalled();
    expect(ensureConfigReadyMock).not.toHaveBeenCalled();

    vi.clearAllMocks();
    process.env.DAISYCLAW_HIDE_BANNER = "1";

    await runPreAction({
      parseArgv: ["status"],
      processArgv: ["node", "daisyclaw", "status"],
    });

    expect(emitCliBannerMock).not.toHaveBeenCalled();
    expect(ensureConfigReadyMock).toHaveBeenCalledTimes(1);
  });

  it("applies --json stdout suppression only for explicit JSON output commands", async () => {
    await runPreAction({
      parseArgv: ["status"],
      processArgv: ["node", "daisyclaw", "status", "--json"],
    });

    expect(ensureConfigReadyMock).toHaveBeenCalledWith({
      runtime: runtimeMock,
      commandPath: ["status"],
      suppressDoctorStdout: true,
    });
    expect(ensurePluginRegistryLoadedMock).not.toHaveBeenCalled();

    vi.clearAllMocks();
    await runPreAction({
      parseArgv: ["update", "status", "--json"],
      processArgv: ["node", "daisyclaw", "update", "status", "--json"],
    });

    expect(ensureConfigReadyMock).toHaveBeenCalledWith({
      runtime: runtimeMock,
      commandPath: ["update", "status"],
      suppressDoctorStdout: true,
    });
    expect(ensurePluginRegistryLoadedMock).not.toHaveBeenCalled();

    vi.clearAllMocks();
    await runPreAction({
      parseArgv: ["config", "set", "gateway.auth.mode", "{bad", "--json"],
      processArgv: ["node", "daisyclaw", "config", "set", "gateway.auth.mode", "{bad", "--json"],
    });

    expect(ensureConfigReadyMock).toHaveBeenCalledWith({
      runtime: runtimeMock,
      commandPath: ["config", "set"],
    });
  });

  it("routes logs to stderr in --json mode so stdout stays clean", async () => {
    await runPreAction({
      parseArgv: ["channels", "send"],
      processArgv: ["node", "daisyclaw", "channels", "send", "--json"],
    });

    expect(routeLogsToStderrMock).toHaveBeenCalledOnce();

    vi.clearAllMocks();

    // config set --json is parse-only (not JSON output mode), should not route
    await runPreAction({
      parseArgv: ["config", "set", "gateway.auth.mode", "local", "--json"],
      processArgv: ["node", "daisyclaw", "config", "set", "gateway.auth.mode", "local", "--json"],
    });

    expect(routeLogsToStderrMock).not.toHaveBeenCalled();

    vi.clearAllMocks();

    // non-json command should not route
    await runPreAction({
      parseArgv: ["agents", "list"],
      processArgv: ["node", "daisyclaw", "agents", "list"],
    });

    expect(routeLogsToStderrMock).not.toHaveBeenCalled();
  });

  it("does not preload plugins for agents list JSON output", async () => {
    await runPreAction({
      parseArgv: ["agents", "list"],
      processArgv: ["node", "daisyclaw", "agents", "list", "--json"],
    });

    expect(routeLogsToStderrMock).toHaveBeenCalledOnce();
    expect(ensurePluginRegistryLoadedMock).not.toHaveBeenCalled();
  });

  it("does not preload plugins for remote agent JSON output", async () => {
    await runPreAction({
      parseArgv: ["agent"],
      processArgv: ["node", "daisyclaw", "agent", "--message", "hi", "--json"],
    });

    expect(routeLogsToStderrMock).toHaveBeenCalledOnce();
    expect(ensurePluginRegistryLoadedMock).not.toHaveBeenCalled();
  });

  it("bypasses config guard for config validate", async () => {
    await runPreAction({
      parseArgv: ["config", "validate"],
      processArgv: ["node", "daisyclaw", "config", "validate"],
    });

    expect(ensureConfigReadyMock).not.toHaveBeenCalled();
    expect(ensurePluginRegistryLoadedMock).not.toHaveBeenCalled();
  });

  it("bypasses config guard for config validate when root option values are present", async () => {
    await runPreAction({
      parseArgv: ["config", "validate"],
      processArgv: ["node", "daisyclaw", "--profile", "work", "config", "validate"],
    });

    expect(ensureConfigReadyMock).not.toHaveBeenCalled();
    expect(ensurePluginRegistryLoadedMock).not.toHaveBeenCalled();
  });

  it("bypasses config guard for config schema", async () => {
    await runPreAction({
      parseArgv: ["config", "schema"],
      processArgv: ["node", "daisyclaw", "config", "schema"],
    });

    expect(ensureConfigReadyMock).not.toHaveBeenCalled();
    expect(ensurePluginRegistryLoadedMock).not.toHaveBeenCalled();
  });

  it("bypasses config guard for backup create", async () => {
    await runPreAction({
      parseArgv: ["backup", "create"],
      processArgv: ["node", "daisyclaw", "backup", "create", "--json"],
    });

    expect(ensureConfigReadyMock).not.toHaveBeenCalled();
    expect(ensurePluginRegistryLoadedMock).not.toHaveBeenCalled();
  });

  it("routes logs to stderr during plugin loading in --json mode and restores after", async () => {
    let stderrDuringPluginLoad = false;
    ensurePluginRegistryLoadedMock.mockImplementation(() => {
      stderrDuringPluginLoad = loggingState.forceConsoleToStderr;
    });

    await runPreAction({
      parseArgv: ["channels", "send"],
      processArgv: ["node", "daisyclaw", "channels", "send", "--json"],
    });

    expect(ensurePluginRegistryLoadedMock).toHaveBeenCalledWith({
      scope: "configured-channels",
    });
    expect(stderrDuringPluginLoad).toBe(true);
    // Flag must be restored after plugin loading completes
    expect(loggingState.forceConsoleToStderr).toBe(false);
  });

  it("does not preload plugins or route logs to stderr for agents list without --json", async () => {
    await runPreAction({
      parseArgv: ["agents", "list"],
      processArgv: ["node", "daisyclaw", "agents", "list"],
    });

    expect(ensurePluginRegistryLoadedMock).not.toHaveBeenCalled();
    expect(loggingState.forceConsoleToStderr).toBe(false);
  });

  beforeAll(() => {
    program = buildProgram();
    const hooks = (
      program as unknown as {
        _lifeCycleHooks?: {
          preAction?: Array<(thisCommand: Command, actionCommand: Command) => Promise<void> | void>;
        };
      }
    )["_lifeCycleHooks"]?.preAction;
    preActionHook = hooks?.[0] ?? null;
  });
});
