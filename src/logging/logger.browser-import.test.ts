// Logger browser import tests cover safe import behavior in browser-like runtimes.
import { importFreshModule } from "daisyclaw/plugin-sdk/test-fixtures";
import { afterEach, describe, expect, it, vi } from "vitest";

type LoggerModule = typeof import("./logger.js");

const originalGetBuiltinModule = (
  process as NodeJS.Process & { getBuiltinModule?: (id: string) => unknown }
).getBuiltinModule;

async function importBrowserSafeLogger(params?: {
  resolvePreferredDaisyClawTmpDir?: ReturnType<typeof vi.fn>;
}): Promise<{
  module: LoggerModule;
  resolvePreferredDaisyClawTmpDir: ReturnType<typeof vi.fn>;
}> {
  const resolvePreferredDaisyClawTmpDir =
    params?.resolvePreferredDaisyClawTmpDir ??
    vi.fn(() => {
      throw new Error("resolvePreferredDaisyClawTmpDir should not run during browser-safe import");
    });

  vi.doMock("../infra/tmp-daisyclaw-dir.js", async () => {
    const actual = await vi.importActual<typeof import("../infra/tmp-daisyclaw-dir.js")>(
      "../infra/tmp-daisyclaw-dir.js",
    );
    return {
      ...actual,
      resolvePreferredDaisyClawTmpDir,
    };
  });

  Object.defineProperty(process, "getBuiltinModule", {
    configurable: true,
    value: undefined,
  });

  const module = await importFreshModule<LoggerModule>(
    import.meta.url,
    "./logger.js?scope=browser-safe",
  );
  return { module, resolvePreferredDaisyClawTmpDir };
}

describe("logging/logger browser-safe import", () => {
  afterEach(() => {
    vi.doUnmock("../infra/tmp-daisyclaw-dir.js");
    Object.defineProperty(process, "getBuiltinModule", {
      configurable: true,
      value: originalGetBuiltinModule,
    });
  });

  it("does not resolve the preferred temp dir at import time when node fs is unavailable", async () => {
    const { module, resolvePreferredDaisyClawTmpDir } = await importBrowserSafeLogger();

    expect(resolvePreferredDaisyClawTmpDir).not.toHaveBeenCalled();
    expect(module.DEFAULT_LOG_DIR).toBe("/tmp/daisyclaw");
    expect(module.DEFAULT_LOG_FILE).toBe("/tmp/daisyclaw/daisyclaw.log");
  });

  it("disables file logging when imported in a browser-like environment", async () => {
    const { module, resolvePreferredDaisyClawTmpDir } = await importBrowserSafeLogger();

    expect(module.getResolvedLoggerSettings()).toStrictEqual({
      level: "silent",
      file: "/tmp/daisyclaw/daisyclaw.log",
      maxFileBytes: 100 * 1024 * 1024,
    });
    expect(module.isFileLogLevelEnabled("info")).toBe(false);
    expect(module.getLogger().info("browser-safe")).toBeUndefined();
    expect(resolvePreferredDaisyClawTmpDir).not.toHaveBeenCalled();
  });
});
