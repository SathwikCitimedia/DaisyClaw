// Onboard skills tests cover skill setup prompts, package manager config, and skip behavior.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DaisyClawConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import type { WizardPrompter } from "../wizard/prompts.js";

const mocks = vi.hoisted(() => ({
  buildWorkspaceSkillStatus: vi.fn(),
  installSkill: vi.fn(),
  detectBinary: vi.fn(),
  isContainerEnvironment: vi.fn(),
  resolveBrewExecutable: vi.fn(),
  resolveNodeManagerOptions: vi.fn(() => [
    { value: "npm", label: "npm" },
    { value: "pnpm", label: "pnpm" },
    { value: "bun", label: "bun" },
  ]),
}));

// Module under test imports these at module scope.
vi.mock("../skills/discovery/status.js", () => ({
  buildWorkspaceSkillStatus: mocks.buildWorkspaceSkillStatus,
}));
vi.mock("../skills/lifecycle/install.js", () => ({
  installSkill: mocks.installSkill,
}));
vi.mock("../infra/container-environment.js", () => ({
  isContainerEnvironment: mocks.isContainerEnvironment,
}));
vi.mock("../infra/brew.js", () => ({
  resolveBrewExecutable: mocks.resolveBrewExecutable,
}));
vi.mock("./onboard-helpers.js", () => ({
  detectBinary: mocks.detectBinary,
  resolveNodeManagerOptions: mocks.resolveNodeManagerOptions,
}));

import { setupSkills } from "./onboard-skills.js";

function createBundledSkill(params: {
  name: string;
  description: string;
  bins: string[];
  os?: string[];
  installLabel: string;
}): {
  name: string;
  description: string;
  source: string;
  bundled: boolean;
  filePath: string;
  baseDir: string;
  skillKey: string;
  always: boolean;
  disabled: boolean;
  blockedByAllowlist: boolean;
  eligible: boolean;
  requirements: {
    bins: string[];
    anyBins: string[];
    env: string[];
    config: string[];
    os: string[];
  };
  missing: { bins: string[]; anyBins: string[]; env: string[]; config: string[]; os: string[] };
  configChecks: [];
  install: Array<{ id: string; kind: string; label: string; bins: string[] }>;
} {
  return {
    name: params.name,
    description: params.description,
    source: "daisyclaw-bundled",
    bundled: true,
    filePath: `/tmp/skills/${params.name}`,
    baseDir: `/tmp/skills/${params.name}`,
    skillKey: params.name,
    always: false,
    disabled: false,
    blockedByAllowlist: false,
    eligible: false,
    requirements: { bins: params.bins, anyBins: [], env: [], config: [], os: params.os ?? [] },
    missing: { bins: params.bins, anyBins: [], env: [], config: [], os: params.os ?? [] },
    configChecks: [],
    install: [{ id: "brew", kind: "brew", label: params.installLabel, bins: params.bins }],
  };
}

function mockMissingBrewStatus(skills: Array<ReturnType<typeof createBundledSkill>>): void {
  mocks.detectBinary.mockResolvedValue(false);
  mocks.resolveBrewExecutable.mockReturnValue(undefined);
  mocks.installSkill.mockResolvedValue({
    ok: true,
    message: "Installed",
    stdout: "",
    stderr: "",
    code: 0,
  });
  mocks.buildWorkspaceSkillStatus.mockReturnValue({
    workspaceDir: "/tmp/ws",
    managedSkillsDir: "/tmp/managed",
    skills,
  } as never);
}

function createPrompter(params: {
  configure?: boolean;
  showBrewInstall?: boolean;
  starterPack?: boolean;
  multiselect?: string[];
}): { prompter: WizardPrompter; notes: Array<{ title?: string; message: string }> } {
  const notes: Array<{ title?: string; message: string }> = [];

  const confirmAnswers: boolean[] = [];
  confirmAnswers.push(params.configure ?? true);

  const prompter: WizardPrompter = {
    intro: vi.fn(async () => {}),
    outro: vi.fn(async () => {}),
    note: vi.fn(async (message: string, title?: string) => {
      notes.push({ title, message });
    }),
    select: vi.fn(async () => "npm") as unknown as WizardPrompter["select"],
    multiselect: vi.fn(
      async () => params.multiselect ?? ["__skip__"],
    ) as unknown as WizardPrompter["multiselect"],
    text: vi.fn(async () => ""),
    confirm: vi.fn(async ({ message }) => {
      if (message.startsWith("Use the recommended starter skill pack")) {
        return params.starterPack ?? false;
      }
      if (message === "Show Homebrew install command?") {
        return params.showBrewInstall ?? false;
      }
      return confirmAnswers.shift() ?? false;
    }),
    progress: vi.fn(() => ({ update: vi.fn(), stop: vi.fn() })),
  };

  return { prompter, notes };
}

const runtime: RuntimeEnv = {
  log: vi.fn(),
  error: vi.fn(),
  exit: ((code: number) => {
    throw new Error(`unexpected exit ${code}`);
  }) as RuntimeEnv["exit"],
};

describe("setupSkills", () => {
  afterEach(() => {
    mocks.isContainerEnvironment.mockReset();
    mocks.resolveBrewExecutable.mockReset();
  });

  it("hides brew-only installs in Linux containers when brew is missing", async () => {
    const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(process, "platform")!;
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
    try {
      mockMissingBrewStatus([
        createBundledSkill({
          name: "video-frames",
          description: "ffmpeg",
          bins: ["ffmpeg"],
          installLabel: "Install ffmpeg (brew)",
        }),
      ]);
      mocks.isContainerEnvironment.mockReturnValue(true);

      const { prompter, notes } = createPrompter({});
      await setupSkills({} as DaisyClawConfig, "/tmp/ws", runtime, prompter);

      expect(prompter.multiselect).not.toHaveBeenCalled();
      expect(mocks.installSkill).not.toHaveBeenCalled();
      expect(notes.find((n) => n.title === "Container skill installs")).toBeDefined();
      expect(notes.find((n) => n.title === "Homebrew recommended")).toBeUndefined();
      expect(
        notes.find((n) => n.message.includes("No missing skill dependencies to install")),
      ).toBeUndefined();
    } finally {
      Object.defineProperty(process, "platform", originalPlatformDescriptor);
    }
  });

  it("keeps brew-only installs visible when Linuxbrew is resolved off PATH", async () => {
    const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(process, "platform")!;
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
    try {
      mockMissingBrewStatus([
        createBundledSkill({
          name: "video-frames",
          description: "ffmpeg",
          bins: ["ffmpeg"],
          installLabel: "Install ffmpeg (brew)",
        }),
      ]);
      mocks.isContainerEnvironment.mockReturnValue(true);
      mocks.resolveBrewExecutable.mockReturnValue("/home/linuxbrew/.linuxbrew/bin/brew");

      const { prompter, notes } = createPrompter({ multiselect: ["video-frames"] });
      await setupSkills({} as DaisyClawConfig, "/tmp/ws", runtime, prompter);

      expect(prompter.multiselect).toHaveBeenCalled();
      expect(mocks.installSkill).toHaveBeenCalledWith(
        expect.objectContaining({ skillName: "video-frames", installId: "brew" }),
      );
      expect(notes.find((n) => n.title === "Container skill installs")).toBeUndefined();
      expect(notes.find((n) => n.title === "Homebrew recommended")).toBeUndefined();
    } finally {
      Object.defineProperty(process, "platform", originalPlatformDescriptor);
    }
  });

  it("does not recommend Homebrew when user skips installing brew-backed deps", async () => {
    if (process.platform === "win32") {
      return;
    }

    mockMissingBrewStatus([
      createBundledSkill({
        name: "apple-reminders",
        description: "macOS-only",
        bins: ["remindctl"],
        os: ["darwin"],
        installLabel: "Install remindctl (brew)",
      }),
      createBundledSkill({
        name: "video-frames",
        description: "ffmpeg",
        bins: ["ffmpeg"],
        installLabel: "Install ffmpeg (brew)",
      }),
    ]);

    const { prompter, notes } = createPrompter({ multiselect: ["__skip__"] });
    await setupSkills({} as DaisyClawConfig, "/tmp/ws", runtime, prompter);

    // OS-mismatched skill should be counted as unsupported, not installable/missing.
    expect(notes.find((n) => n.title === "Skills status")).toStrictEqual({
      title: "Skills status",
      message: [
        "Eligible: 0",
        "Missing requirements: 1",
        "Unsupported on this OS: 1",
        "Blocked by allowlist: 0",
      ].join("\n"),
    });

    const brewNote = notes.find((n) => n.title === "Homebrew recommended");
    expect(brewNote).toBeUndefined();
  });

  it("recommends Homebrew when user selects a brew-backed install and brew is missing", async () => {
    if (process.platform === "win32") {
      return;
    }

    mockMissingBrewStatus([
      createBundledSkill({
        name: "video-frames",
        description: "ffmpeg",
        bins: ["ffmpeg"],
        installLabel: "Install ffmpeg (brew)",
      }),
    ]);

    const { prompter, notes } = createPrompter({ multiselect: ["video-frames"] });
    await setupSkills({} as DaisyClawConfig, "/tmp/ws", runtime, prompter);

    const brewNote = notes.find((n) => n.title === "Homebrew recommended");
    expect(brewNote?.title).toBe("Homebrew recommended");
  });

  it("auto-installs starter-pack tools with unattended recipes when the pack is accepted", async () => {
    const spotify = {
      ...createBundledSkill({
        name: "spotify-player",
        description: "Spotify",
        bins: [],
        installLabel: "unused",
      }),
      missing: { bins: [], anyBins: ["spogo", "spotify_player"], env: [], config: [], os: [] },
      install: [
        {
          id: "download-win-x64",
          kind: "download",
          label: "Download spotify_player (Windows x64)",
          bins: ["spotify_player"],
        },
      ],
    };
    const gog = {
      ...createBundledSkill({
        name: "gog",
        description: "Google",
        bins: ["gog"],
        installLabel: "unused",
      }),
      install: [{ id: "download-win-x64", kind: "download", label: "Download gog", bins: ["gog"] }],
    };
    // Brew recipes stay interactive; the auto-installer must skip them.
    const brewOnly = createBundledSkill({
      name: "weather",
      description: "brew-only",
      bins: ["curl"],
      installLabel: "Install curl (brew)",
    });
    mockMissingBrewStatus([spotify, gog, brewOnly] as never);
    // Call history is shared across tests in this file; scope assertions to this test.
    mocks.installSkill.mockClear();
    mocks.installSkill
      .mockResolvedValueOnce({
        ok: false,
        message: "network down",
        stdout: "",
        stderr: "",
        code: 1,
      })
      .mockResolvedValue({ ok: true, message: "Installed", stdout: "", stderr: "", code: 0 });

    const { prompter, notes } = createPrompter({ starterPack: true, configure: false });
    await setupSkills({} as DaisyClawConfig, "/tmp/ws", runtime, prompter);

    const autoInstallCalls = mocks.installSkill.mock.calls.map(
      (call) => (call[0] as { skillName: string; installId: string }).skillName,
    );
    expect(autoInstallCalls).toEqual(["spotify-player", "gog"]);
    expect(mocks.installSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skillName: "gog", installId: "download-win-x64" }),
    );
    const summary = notes.find((n) => n.title === "Starter tools");
    expect(summary?.message).toContain("Ready to use: gog");
    expect(summary?.message).toContain("Needs attention: spotify-player");
  });

  it("applies the starter skill pack when accepted", async () => {
    mockMissingBrewStatus([]);

    const { prompter, notes } = createPrompter({ starterPack: true });
    const result = await setupSkills({} as DaisyClawConfig, "/tmp/ws", runtime, prompter);

    expect(notes.find((n) => n.title === "Starter skill pack")).toBeDefined();
    expect(result.skills?.entries?.tmux?.enabled).toBe(false);
    expect(result.skills?.entries?.healthcheck?.enabled).toBe(false);
    expect(result.skills?.entries?.weather).toBeUndefined();
    expect(result.skills?.entries?.["spotify-player"]).toBeUndefined();
  });

  it("keeps the config untouched when the starter skill pack is declined", async () => {
    mockMissingBrewStatus([]);

    const { prompter, notes } = createPrompter({ starterPack: false });
    const result = await setupSkills({} as DaisyClawConfig, "/tmp/ws", runtime, prompter);

    expect(notes.find((n) => n.title === "Starter skill pack")).toBeUndefined();
    expect(result.skills?.entries).toBeUndefined();
  });

  it("displays a clear empty state note when all skill dependencies are ready", async () => {
    mockMissingBrewStatus([]);

    const { prompter, notes } = createPrompter({});
    await setupSkills({} as DaisyClawConfig, "/tmp/ws", runtime, prompter);

    expect(prompter.multiselect).not.toHaveBeenCalled();
    const emptyStateNote = notes.find((n) => n.title === "All skills ready");
    expect(emptyStateNote?.message).toContain("No missing skill dependencies to install");
    expect(emptyStateNote?.message).toContain("daisyclaw skills list --verbose");
    expect(emptyStateNote?.message).toContain("daisyclaw skills check");
  });
});
