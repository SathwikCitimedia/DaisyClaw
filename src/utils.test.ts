// Tests shared utility helpers used by CLI and runtime modules.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { MAX_TIMER_TIMEOUT_MS } from "./shared/number-coercion.js";
import { withTempDir } from "./test-helpers/temp-dir.js";
import { withEnv } from "./test-utils/env.js";
import {
  ensureDir,
  resolveConfigDir,
  resolveHomeDir,
  resolveUserPath,
  shortenHomeInString,
  shortenHomePath,
  sleep,
} from "./utils.js";

describe("ensureDir", () => {
  it("creates nested directory", async () => {
    await withTempDir({ prefix: "daisyclaw-test-" }, async (tmp) => {
      const target = path.join(tmp, "nested", "dir");
      await ensureDir(target);
      expect(fs.existsSync(target)).toBe(true);
    });
  });
});

describe("sleep", () => {
  it("resolves after delay using fake timers", async () => {
    vi.useFakeTimers();
    try {
      const promise = sleep(1000);
      vi.advanceTimersByTime(1000);
      await expect(promise).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("clamps oversized sleep delays before scheduling", async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    try {
      const promise = sleep(Number.MAX_SAFE_INTEGER);

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), MAX_TIMER_TIMEOUT_MS);

      vi.advanceTimersByTime(MAX_TIMER_TIMEOUT_MS);
      await expect(promise).resolves.toBeUndefined();
    } finally {
      setTimeoutSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});

describe("resolveConfigDir", () => {
  it("prefers ~/.daisyclaw when legacy dir is missing", async () => {
    await withTempDir({ prefix: "daisyclaw-config-dir-" }, async (root) => {
      const newDir = path.join(root, ".daisyclaw");
      await fs.promises.mkdir(newDir, { recursive: true });
      const resolved = resolveConfigDir({} as NodeJS.ProcessEnv, () => root);
      expect(resolved).toBe(newDir);
    });
  });

  it("expands DAISYCLAW_STATE_DIR using the provided env", () => {
    const env = {
      HOME: "/tmp/daisyclaw-home",
      DAISYCLAW_STATE_DIR: "~/state",
    } as NodeJS.ProcessEnv;

    expect(resolveConfigDir(env)).toBe(path.resolve("/tmp/daisyclaw-home", "state"));
  });

  it("falls back to the config file directory when only DAISYCLAW_CONFIG_PATH is set", () => {
    const env = {
      HOME: "/tmp/daisyclaw-home",
      DAISYCLAW_CONFIG_PATH: "~/profiles/dev/daisyclaw.json",
    } as NodeJS.ProcessEnv;

    expect(resolveConfigDir(env)).toBe(path.resolve("/tmp/daisyclaw-home", "profiles", "dev"));
  });
});

describe("resolveHomeDir", () => {
  it("prefers DAISYCLAW_HOME over HOME", () => {
    withEnv({ DAISYCLAW_HOME: "/srv/daisyclaw-home", HOME: "/home/other" }, () => {
      expect(resolveHomeDir()).toBe(path.resolve("/srv/daisyclaw-home"));
    });
  });
});

describe("shortenHomePath", () => {
  it("uses $DAISYCLAW_HOME prefix when DAISYCLAW_HOME is set", () => {
    withEnv({ DAISYCLAW_HOME: "/srv/daisyclaw-home", HOME: "/home/other" }, () => {
      expect(shortenHomePath(`${path.resolve("/srv/daisyclaw-home")}/.daisyclaw/daisyclaw.json`)).toBe(
        "$DAISYCLAW_HOME/.daisyclaw/daisyclaw.json",
      );
    });
  });
});

describe("shortenHomeInString", () => {
  it("uses $DAISYCLAW_HOME replacement when DAISYCLAW_HOME is set", () => {
    withEnv({ DAISYCLAW_HOME: "/srv/daisyclaw-home", HOME: "/home/other" }, () => {
      expect(
        shortenHomeInString(
          `config: ${path.resolve("/srv/daisyclaw-home")}/.daisyclaw/daisyclaw.json`,
        ),
      ).toBe("config: $DAISYCLAW_HOME/.daisyclaw/daisyclaw.json");
    });
  });
});

describe("resolveUserPath", () => {
  it("expands ~ to home dir", () => {
    expect(resolveUserPath("~", {}, () => "/Users/thoffman")).toBe(path.resolve("/Users/thoffman"));
  });

  it("expands ~/ to home dir", () => {
    expect(resolveUserPath("~/daisyclaw", {}, () => "/Users/thoffman")).toBe(
      path.resolve("/Users/thoffman", "daisyclaw"),
    );
  });

  it("resolves relative paths", () => {
    expect(resolveUserPath("tmp/dir")).toBe(path.resolve("tmp/dir"));
  });

  it("prefers DAISYCLAW_HOME for tilde expansion", () => {
    withEnv({ DAISYCLAW_HOME: "/srv/daisyclaw-home", HOME: "/home/other" }, () => {
      expect(resolveUserPath("~/daisyclaw")).toBe(path.resolve("/srv/daisyclaw-home", "daisyclaw"));
    });
  });

  it("uses the provided env for tilde expansion", () => {
    const env = {
      HOME: "/tmp/daisyclaw-home",
      DAISYCLAW_HOME: "/srv/daisyclaw-home",
    } as NodeJS.ProcessEnv;

    expect(resolveUserPath("~/daisyclaw", env)).toBe(path.resolve("/srv/daisyclaw-home", "daisyclaw"));
  });

  it("keeps blank paths blank", () => {
    expect(resolveUserPath("")).toBe("");
    expect(resolveUserPath("   ")).toBe("");
  });

  it("returns empty string for undefined/null input", () => {
    expect(resolveUserPath(undefined as unknown as string)).toBe("");
    expect(resolveUserPath(null as unknown as string)).toBe("");
  });
});
