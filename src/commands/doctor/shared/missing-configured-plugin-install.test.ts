// Missing configured plugin install tests cover doctor diagnostics for absent plugin installs.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveRegistryUpdateChannel } from "../../../infra/update-channels.js";
import {
  resolveClawHubInstallSpecsForUpdateChannel,
  resolveNpmInstallSpecsForUpdateChannel,
} from "../../../plugins/install-channel-specs.js";
import { VERSION } from "../../../version.js";

function expectedNpmInstallSpec(spec: string): string {
  return resolveNpmInstallSpecsForUpdateChannel({
    spec,
    updateChannel: resolveRegistryUpdateChannel({ currentVersion: VERSION }),
  }).installSpec;
}

function expectedClawHubInstallSpec(spec: string): string {
  return resolveClawHubInstallSpecsForUpdateChannel({
    spec,
    updateChannel: resolveRegistryUpdateChannel({ currentVersion: VERSION }),
  }).installSpec;
}

function currentDaisyClawReleaseBase(): string {
  return VERSION.replace(/-(?:alpha|beta)\.[1-9]\d*$/u, "");
}

function expectRecordFields(record: unknown, expected: Record<string, unknown>) {
  if (!record || typeof record !== "object") {
    throw new Error("Expected record");
  }
  const actual = record as Record<string, unknown>;
  for (const [key, value] of Object.entries(expected)) {
    expect(actual[key]).toEqual(value);
  }
  return actual;
}

function mockCallArg(mock: ReturnType<typeof vi.fn>, callIndex = 0, argIndex = 0) {
  const call = mock.mock.calls[callIndex];
  if (!call) {
    throw new Error(`Expected mock call ${callIndex}`);
  }
  return call[argIndex];
}

const mocks = vi.hoisted(() => ({
  installPluginFromClawHub: vi.fn(),
  installPluginFromNpmSpec: vi.fn(),
  listChannelPluginCatalogEntries: vi.fn(),
  listOfficialExternalPluginCatalogEntries: vi.fn(),
  loadInstalledPluginIndex: vi.fn(),
  loadInstalledPluginIndexInstallRecords: vi.fn(),
  loadPluginMetadataSnapshot: vi.fn(),
  getOfficialExternalPluginCatalogManifest: vi.fn(
    (entry: { daisyclaw?: unknown }) => entry.daisyclaw,
  ),
  resolveOfficialExternalPluginId: vi.fn((entry: { id?: string }) => entry.id),
  resolveOfficialExternalPluginInstall: vi.fn(
    (entry: { install?: unknown }) => entry.install ?? null,
  ),
  resolveOfficialExternalPluginLabel: vi.fn(
    (entry: { label?: string; id?: string }) => entry.label ?? entry.id ?? "plugin",
  ),
  resolveDefaultPluginExtensionsDir: vi.fn(() => "/tmp/daisyclaw-plugins"),
  resolveDefaultPluginNpmDir: vi.fn(() => "/tmp/daisyclaw-npm"),
  resolvePluginNpmPackageDir: vi.fn(
    ({ npmDir, packageName }: { npmDir?: string; packageName: string }) =>
      path.join(
        npmDir ?? "/tmp/daisyclaw-npm",
        "projects",
        packageName.replace(/[^a-zA-Z0-9._-]+/g, "-"),
        "node_modules",
        ...packageName.split("/"),
      ),
  ),
  resolvePluginInstallDir: vi.fn(
    (pluginId: string, extensionsDir = "/tmp/daisyclaw-plugins") => `${extensionsDir}/${pluginId}`,
  ),
  validatePluginId: vi.fn(() => null),
  resolveProviderInstallCatalogEntries: vi.fn(),
  updateNpmInstalledPlugins: vi.fn(),
  writePersistedInstalledPluginIndexInstallRecords: vi.fn(),
}));

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "daisyclaw-plugin-stub-repair-"));
  tempDirs.push(dir);
  return dir;
}

function writeLegacyNpmDeclarationStub(params: {
  pluginDir: string;
  pluginId: string;
  npmSpec: string;
}): void {
  fs.mkdirSync(params.pluginDir, { recursive: true });
  fs.writeFileSync(
    path.join(params.pluginDir, "daisyclaw.extension.json"),
    JSON.stringify({
      name: params.pluginId,
      type: "npm",
      npmSpec: params.npmSpec,
    }),
    "utf8",
  );
}

vi.mock("../../../channels/plugins/catalog.js", () => ({
  listChannelPluginCatalogEntries: mocks.listChannelPluginCatalogEntries,
  listRawChannelPluginCatalogEntries: mocks.listChannelPluginCatalogEntries,
}));

vi.mock("../../../plugins/installed-plugin-index-records.js", () => ({
  loadInstalledPluginIndexInstallRecords: mocks.loadInstalledPluginIndexInstallRecords,
  writePersistedInstalledPluginIndexInstallRecords:
    mocks.writePersistedInstalledPluginIndexInstallRecords,
}));

vi.mock("../../../plugins/installed-plugin-index.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../plugins/installed-plugin-index.js")>()),
  loadInstalledPluginIndex: mocks.loadInstalledPluginIndex,
}));

vi.mock("../../../plugins/install-paths.js", () => ({
  resolveDefaultPluginExtensionsDir: mocks.resolveDefaultPluginExtensionsDir,
  resolveDefaultPluginNpmDir: mocks.resolveDefaultPluginNpmDir,
  resolvePluginNpmPackageDir: mocks.resolvePluginNpmPackageDir,
  resolvePluginInstallDir: mocks.resolvePluginInstallDir,
  validatePluginId: mocks.validatePluginId,
}));

vi.mock("../../../plugins/install.js", () => ({
  installPluginFromNpmSpec: mocks.installPluginFromNpmSpec,
}));

vi.mock("../../../plugins/clawhub.js", () => ({
  CLAWHUB_INSTALL_ERROR_CODE: {
    PACKAGE_NOT_FOUND: "package_not_found",
    VERSION_NOT_FOUND: "version_not_found",
    ARTIFACT_UNAVAILABLE: "artifact_unavailable",
    ARTIFACT_DOWNLOAD_UNAVAILABLE: "artifact_download_unavailable",
  },
  installPluginFromClawHub: mocks.installPluginFromClawHub,
}));

vi.mock("../../../plugins/plugin-metadata-snapshot.js", () => ({
  loadPluginMetadataSnapshot: mocks.loadPluginMetadataSnapshot,
  resolvePluginMetadataSnapshot: mocks.loadPluginMetadataSnapshot,
}));

vi.mock("../../../plugins/official-external-plugin-catalog.js", () => ({
  getOfficialExternalPluginCatalogManifest: mocks.getOfficialExternalPluginCatalogManifest,
  listOfficialExternalPluginCatalogEntries: mocks.listOfficialExternalPluginCatalogEntries,
  resolveOfficialExternalPluginId: mocks.resolveOfficialExternalPluginId,
  resolveOfficialExternalPluginInstall: mocks.resolveOfficialExternalPluginInstall,
  resolveOfficialExternalPluginLabel: mocks.resolveOfficialExternalPluginLabel,
}));

vi.mock("../../../plugins/provider-install-catalog.js", () => ({
  resolveProviderInstallCatalogEntries: mocks.resolveProviderInstallCatalogEntries,
}));

vi.mock("../../../plugins/update.js", () => ({
  updateNpmInstalledPlugins: mocks.updateNpmInstalledPlugins,
}));

describe("repairMissingConfiguredPluginInstalls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [],
      diagnostics: [],
    });
    mocks.loadInstalledPluginIndex.mockReturnValue({
      plugins: [],
      diagnostics: [],
      installRecords: {},
    });
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue({});
    mocks.listChannelPluginCatalogEntries.mockReturnValue([]);
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([]);
    mocks.resolveDefaultPluginExtensionsDir.mockReturnValue("/tmp/daisyclaw-plugins");
    mocks.resolveDefaultPluginNpmDir.mockReturnValue("/tmp/daisyclaw-npm");
    mocks.resolveProviderInstallCatalogEntries.mockReturnValue([]);
    mocks.installPluginFromClawHub.mockResolvedValue({
      ok: true,
      pluginId: "matrix",
      targetDir: "/tmp/daisyclaw-plugins/matrix",
      version: "1.2.3",
      clawhub: {
        source: "clawhub",
        clawhubUrl: "https://clawhub.ai",
        clawhubPackage: "@daisyclaw/plugin-matrix",
        clawhubFamily: "code-plugin",
        clawhubChannel: "official",
        version: "1.2.3",
        integrity: "sha256-clawhub",
        resolvedAt: "2026-05-01T00:00:00.000Z",
        clawpackSha256: "0".repeat(64),
        clawpackSpecVersion: 1,
        clawpackManifestSha256: "1".repeat(64),
        clawpackSize: 1234,
      },
    });
    mocks.installPluginFromNpmSpec.mockResolvedValue({
      ok: true,
      pluginId: "matrix",
      targetDir: "/tmp/daisyclaw-plugins/matrix",
      version: "1.2.3",
      npmResolution: {
        name: "@daisyclaw/plugin-matrix",
        version: "1.2.3",
        resolvedSpec: "@daisyclaw/plugin-matrix@1.2.3",
        integrity: "sha512-test",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });
  });

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("installs a missing configured DaisyClaw channel plugin from npm by default", async () => {
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "matrix",
        pluginId: "matrix",
        meta: { label: "Matrix" },
        install: {
          npmSpec: "@daisyclaw/plugin-matrix@1.2.3",
          expectedIntegrity: "sha512-test",
        },
        trustedSourceLinkedOfficialInstall: true,
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        channels: {
          matrix: { enabled: true, homeserver: "https://matrix.example.org" },
        },
      },
      env: {},
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: "@daisyclaw/plugin-matrix@1.2.3",
      extensionsDir: "/tmp/daisyclaw-plugins",
      expectedPluginId: "matrix",
      expectedIntegrity: "sha512-test",
      trustedSourceLinkedOfficialInstall: true,
    });
    const records = mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords);
    expectRecordFields((records as Record<string, unknown>).matrix, {
      source: "npm",
      spec: "@daisyclaw/plugin-matrix@1.2.3",
      installPath: "/tmp/daisyclaw-plugins/matrix",
      version: "1.2.3",
    });
    expect(mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords, 0, 1)).toEqual({
      env: {},
    });
    expect(result.changes).toEqual([
      'Installed missing configured plugin "matrix" from @daisyclaw/plugin-matrix@1.2.3.',
    ]);
    expect(result.warnings).toStrictEqual([]);
  });

  it("uses an explicit ClawHub install spec before npm", async () => {
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "matrix",
        pluginId: "matrix",
        meta: { label: "Matrix" },
        install: {
          clawhubSpec: "clawhub:@daisyclaw/plugin-matrix@stable",
          npmSpec: "@daisyclaw/plugin-matrix@1.2.3",
          expectedIntegrity: "sha512-test",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        channels: {
          matrix: { enabled: true, homeserver: "https://matrix.example.org" },
        },
      },
      env: {},
    });

    expectRecordFields(mockCallArg(mocks.installPluginFromClawHub), {
      spec: "clawhub:@daisyclaw/plugin-matrix@stable",
      expectedPluginId: "matrix",
    });
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(result.changes).toEqual([
      'Installed missing configured plugin "matrix" from clawhub:@daisyclaw/plugin-matrix@stable.',
    ]);
    expect(result.warnings).toStrictEqual([]);
  });

  it("installs a missing channel plugin selected by environment config from npm", async () => {
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "matrix",
      targetDir: "/tmp/daisyclaw-plugins/matrix",
      version: "1.2.3",
      npmResolution: {
        name: "@daisyclaw/plugin-matrix",
        version: "1.2.3",
        resolvedSpec: "@daisyclaw/plugin-matrix@1.2.3",
        integrity: "sha512-matrix",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "matrix",
        pluginId: "matrix",
        meta: { label: "Matrix" },
        install: {
          npmSpec: "@daisyclaw/plugin-matrix@1.2.3",
        },
        trustedSourceLinkedOfficialInstall: true,
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {},
      env: { MATRIX_HOMESERVER: "https://matrix.example.org" },
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: "@daisyclaw/plugin-matrix@1.2.3",
      extensionsDir: "/tmp/daisyclaw-plugins",
      expectedPluginId: "matrix",
      trustedSourceLinkedOfficialInstall: true,
    });
    const records = mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords);
    expectRecordFields((records as Record<string, unknown>).matrix, {
      source: "npm",
      spec: "@daisyclaw/plugin-matrix@1.2.3",
      installPath: "/tmp/daisyclaw-plugins/matrix",
    });
    expect(mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords, 0, 1)).toEqual({
      env: { MATRIX_HOMESERVER: "https://matrix.example.org" },
    });
    expect(result.changes).toEqual([
      'Installed missing configured plugin "matrix" from @daisyclaw/plugin-matrix@1.2.3.',
    ]);
    expect(result.warnings).toStrictEqual([]);
  });

  it("falls back to npm when an DaisyClaw channel plugin artifact is unavailable on ClawHub", async () => {
    mocks.installPluginFromClawHub.mockResolvedValueOnce({
      ok: false,
      code: "artifact_unavailable",
      error: "ClawHub artifact download is not available yet.",
    });
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "matrix",
        pluginId: "matrix",
        meta: { label: "Matrix" },
        install: {
          clawhubSpec: "clawhub:@daisyclaw/plugin-matrix@stable",
          npmSpec: "@daisyclaw/plugin-matrix@1.2.3",
        },
        trustedSourceLinkedOfficialInstall: true,
      },
    ]);

    const { repairMissingPluginInstallsForIds } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingPluginInstallsForIds({
      cfg: {},
      pluginIds: [],
      channelIds: ["matrix"],
      env: {},
    });

    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: "@daisyclaw/plugin-matrix@1.2.3",
      expectedPluginId: "matrix",
      trustedSourceLinkedOfficialInstall: true,
    });
    expect(result.changes).toEqual([
      'ClawHub clawhub:@daisyclaw/plugin-matrix@stable unavailable for "matrix"; falling back to npm @daisyclaw/plugin-matrix@1.2.3.',
      'Installed missing configured plugin "matrix" from @daisyclaw/plugin-matrix@1.2.3.',
    ]);
    expect(result.warnings).toStrictEqual([]);
  });

  it("does not fall back from ClawHub to non-DaisyClaw npm packages", async () => {
    mocks.installPluginFromClawHub.mockResolvedValueOnce({
      ok: false,
      code: "artifact_download_unavailable",
      error: "ClawHub artifact download is not available yet.",
    });
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "matrix",
        pluginId: "matrix",
        meta: { label: "Matrix" },
        install: {
          clawhubSpec: "clawhub:@daisyclaw/plugin-matrix@stable",
          npmSpec: "@someone-else/plugin-matrix@1.2.3",
        },
      },
    ]);

    const { repairMissingPluginInstallsForIds } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingPluginInstallsForIds({
      cfg: {},
      pluginIds: [],
      channelIds: ["matrix"],
      env: {},
    });

    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(result.changes).toStrictEqual([]);
    expect(result.warnings).toEqual([
      'Failed to install missing configured plugin "matrix" from clawhub:@daisyclaw/plugin-matrix@stable: ClawHub artifact download is not available yet.',
    ]);
  });

  it("honors npm-first catalog metadata for missing DaisyClaw channel plugins", async () => {
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "twitch",
      targetDir: "/tmp/daisyclaw-plugins/twitch",
      version: "2026.5.2",
      npmResolution: {
        name: "@daisyclaw/twitch",
        version: "2026.5.2",
        resolvedSpec: "@daisyclaw/twitch@2026.5.2",
        integrity: "sha512-twitch",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "twitch",
        pluginId: "twitch",
        meta: { label: "Twitch" },
        install: {
          npmSpec: "@daisyclaw/twitch",
          defaultChoice: "npm",
        },
        trustedSourceLinkedOfficialInstall: true,
      },
    ]);

    const { repairMissingPluginInstallsForIds } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingPluginInstallsForIds({
      cfg: {},
      pluginIds: [],
      channelIds: ["twitch"],
      env: {},
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@daisyclaw/twitch"),
      expectedPluginId: "twitch",
      trustedSourceLinkedOfficialInstall: true,
    });
    expect(result.changes).toEqual([
      `Installed missing configured plugin "twitch" from ${expectedNpmInstallSpec("@daisyclaw/twitch")}.`,
    ]);
  });

  it("installs missing configured non-channel plugins from the official external catalog", async () => {
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "diagnostics-otel",
      targetDir: "/tmp/daisyclaw-plugins/diagnostics-otel",
      version: "2026.5.2",
      npmResolution: {
        name: "@daisyclaw/diagnostics-otel",
        version: "2026.5.2",
        resolvedSpec: "@daisyclaw/diagnostics-otel@2026.5.2",
        integrity: "sha512-otel",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "diagnostics-otel",
        label: "Diagnostics OpenTelemetry",
        install: {
          clawhubSpec: "clawhub:@daisyclaw/diagnostics-otel",
          npmSpec: "@daisyclaw/diagnostics-otel",
          defaultChoice: "npm",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            "diagnostics-otel": { enabled: true },
          },
        },
      },
      env: {},
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@daisyclaw/diagnostics-otel"),
      expectedPluginId: "diagnostics-otel",
    });
    expect(result.changes).toEqual([
      `Installed missing configured plugin "diagnostics-otel" from ${expectedNpmInstallSpec("@daisyclaw/diagnostics-otel")}.`,
    ]);
  });

  it("installs the official llama.cpp plugin for configured local memory embeddings", async () => {
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "llama-cpp",
      targetDir: "/tmp/daisyclaw-plugins/llama-cpp",
      version: "2026.6.2",
      npmResolution: {
        name: "@daisyclaw/llama-cpp-provider",
        version: "2026.6.2",
        resolvedSpec: "@daisyclaw/llama-cpp-provider@2026.6.2",
        integrity: "sha512-llama",
        resolvedAt: "2026-06-08T00:00:00.000Z",
      },
    });
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "llama-cpp",
        label: "llama.cpp Provider",
        daisyclaw: {
          plugin: { id: "llama-cpp", label: "llama.cpp Provider" },
          contracts: { embeddingProviders: ["local"] },
          install: {
            npmSpec: "@daisyclaw/llama-cpp-provider",
            defaultChoice: "npm",
          },
        },
        install: {
          npmSpec: "@daisyclaw/llama-cpp-provider",
          defaultChoice: "npm",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        agents: {
          defaults: {
            memorySearch: {
              provider: "local",
            },
          },
        },
      },
      env: {},
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@daisyclaw/llama-cpp-provider"),
      expectedPluginId: "llama-cpp",
    });
    expect(result.changes).toEqual([
      `Installed missing configured plugin "llama-cpp" from ${expectedNpmInstallSpec("@daisyclaw/llama-cpp-provider")}.`,
    ]);
  });

  it("does not let runtime fallback metadata override official catalog install specs", async () => {
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "acpx",
      targetDir: "/tmp/daisyclaw-plugins/acpx",
      version: "2026.5.2-beta.2",
      npmResolution: {
        name: "@daisyclaw/acpx",
        version: "2026.5.2-beta.2",
        resolvedSpec: "@daisyclaw/acpx@2026.5.2-beta.2",
        integrity: "sha512-acpx",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "acpx",
        label: "ACPX Runtime",
        install: {
          npmSpec: "@daisyclaw/acpx",
          defaultChoice: "npm",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        acp: {
          backend: "acpx",
        },
      },
      env: {},
    });

    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@daisyclaw/acpx"),
      expectedPluginId: "acpx",
      trustedSourceLinkedOfficialInstall: true,
    });
    expect(result.changes).toEqual([
      `Installed missing configured plugin "acpx" from ${expectedNpmInstallSpec("@daisyclaw/acpx")}.`,
    ]);
  });

  it("does not install disabled configured plugin entries", async () => {
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "diagnostics-otel",
        label: "Diagnostics OpenTelemetry",
        install: {
          npmSpec: "@daisyclaw/diagnostics-otel",
          defaultChoice: "npm",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            "diagnostics-otel": { enabled: false },
          },
        },
      },
      env: {},
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
    expect(result).toEqual({ changes: [], warnings: [], records: {} });
  });

  it.each([
    ["enabled-only disabled stub", { channels: { matrix: { enabled: false } } }],
    [
      "disabled configured channel",
      { channels: { matrix: { enabled: false, homeserver: "https://matrix.example.org" } } },
    ],
  ])("does not install channel plugins for a %s", async (_label, cfg) => {
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "matrix",
        pluginId: "matrix",
        meta: { label: "Matrix" },
        install: {
          npmSpec: "@daisyclaw/plugin-matrix@1.2.3",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg,
      env: {},
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
    expect(result).toEqual({ changes: [], warnings: [], records: {} });
  });

  it("does not install channel plugins when the matching plugin entry is disabled", async () => {
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "matrix",
        pluginId: "matrix",
        meta: { label: "Matrix" },
        install: {
          npmSpec: "@daisyclaw/plugin-matrix@1.2.3",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            matrix: { enabled: false },
          },
        },
        channels: {
          matrix: { homeserver: "https://matrix.example.org" },
        },
      },
      env: {},
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
    expect(result).toEqual({ changes: [], warnings: [], records: {} });
  });

  it("does not download configured channel plugins that are still bundled", async () => {
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "matrix",
        pluginId: "matrix",
        origin: "bundled",
        meta: { label: "Matrix" },
        install: {
          npmSpec: "@daisyclaw/matrix",
        },
      },
    ]);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [
        {
          id: "matrix",
          origin: "bundled",
          packageName: "@daisyclaw/matrix",
          channels: ["matrix"],
        },
      ],
      diagnostics: [],
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            matrix: { enabled: true },
          },
        },
        channels: {
          matrix: { enabled: true, homeserver: "https://matrix.example.org" },
        },
      },
      env: {},
    });

    expect(mocks.updateNpmInstalledPlugins).not.toHaveBeenCalled();
    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
    expect(result).toEqual({ changes: [], warnings: [], records: {} });
  });

  it("removes stale managed install records when the configured plugin is bundled", async () => {
    const records = {
      matrix: {
        source: "npm",
        spec: "@daisyclaw/matrix",
        installPath: "/missing/matrix",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "matrix",
        pluginId: "matrix",
        origin: "bundled",
        meta: { label: "Matrix" },
        install: {
          npmSpec: "@daisyclaw/matrix",
        },
      },
    ]);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [
        {
          id: "matrix",
          origin: "bundled",
          packageName: "@daisyclaw/matrix",
          channels: ["matrix"],
        },
      ],
      diagnostics: [
        {
          pluginId: "matrix",
          message: "manifest without channelConfigs metadata",
        },
      ],
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            matrix: { enabled: true },
          },
        },
        channels: {
          matrix: { enabled: true, homeserver: "https://matrix.example.org" },
        },
      },
      env: {},
    });

    expect(mocks.updateNpmInstalledPlugins).not.toHaveBeenCalled();
    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).toHaveBeenCalledWith(
      {},
      {
        env: {},
      },
    );
    expect(result).toEqual({
      changes: ['Removed stale managed install record for bundled plugin "matrix".'],
      warnings: [],
      records: {},
    });
  });

  it("uses current bundled discovery to remove records before stale snapshots can reinstall official plugins", async () => {
    const records = {
      "google-meet": {
        source: "npm",
        spec: "@daisyclaw/google-meet",
        resolvedName: "@daisyclaw/google-meet",
        installPath: "/missing/google-meet",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [
        {
          id: "google-meet",
          origin: "npm",
          packageName: "@daisyclaw/google-meet",
        },
      ],
      diagnostics: [],
    });
    mocks.loadInstalledPluginIndex.mockReturnValue({
      plugins: [
        {
          pluginId: "google-meet",
          origin: "bundled",
          packageName: "@daisyclaw/google-meet",
        },
      ],
      diagnostics: [],
      installRecords: {},
    });
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "google-meet",
        label: "Google Meet",
        install: { npmSpec: "@daisyclaw/google-meet" },
        daisyclaw: {
          id: "google-meet",
          install: { npmSpec: "@daisyclaw/google-meet" },
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            "google-meet": { enabled: true },
          },
        },
      },
      env: {},
    });

    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).toHaveBeenCalledWith(
      {},
      {
        env: {},
      },
    );
    expect(result).toEqual({
      changes: ['Removed stale managed install record for bundled plugin "google-meet".'],
      warnings: [],
      records: {},
    });
  });

  it("removes stale bundled install records even when the plugin is not configured", async () => {
    const records = {
      "google-meet": {
        source: "npm",
        spec: "@daisyclaw/google-meet",
        resolvedName: "@daisyclaw/google-meet",
        installPath: "/missing/google-meet",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [],
      diagnostics: [],
    });
    mocks.loadInstalledPluginIndex.mockReturnValue({
      plugins: [
        {
          pluginId: "google-meet",
          origin: "bundled",
          packageName: "@daisyclaw/google-meet",
        },
      ],
      diagnostics: [],
      installRecords: {},
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {},
      env: {},
    });

    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).toHaveBeenCalledWith(
      {},
      {
        env: {},
      },
    );
    expect(result).toEqual({
      changes: ['Removed stale managed install record for bundled plugin "google-meet".'],
      warnings: [],
      records: {},
    });
  });

  it.each([
    [
      "npm",
      {
        source: "npm",
        spec: "@daisyclaw/matrix-fork",
        resolvedName: "@daisyclaw/matrix-fork",
        resolvedSpec: "@daisyclaw/matrix-fork@1.2.3",
        installPath: "/missing/matrix-fork",
      },
    ],
    [
      "clawhub",
      {
        source: "clawhub",
        spec: "clawhub:@daisyclaw/matrix-fork@stable",
        clawhubPackage: "@daisyclaw/matrix-fork",
        installPath: "/missing/matrix-fork",
      },
    ],
  ])(
    "keeps %s install records whose package names only share a bundled prefix",
    async (_, record) => {
      const records = { matrix: record };
      mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
      mocks.listChannelPluginCatalogEntries.mockReturnValue([
        {
          id: "matrix",
          pluginId: "matrix",
          origin: "bundled",
          meta: { label: "Matrix" },
          install: {
            npmSpec: "@daisyclaw/matrix",
          },
        },
      ]);
      mocks.loadPluginMetadataSnapshot.mockReturnValue({
        plugins: [
          {
            id: "matrix",
            origin: "bundled",
            packageName: "@daisyclaw/matrix",
            channels: ["matrix"],
          },
        ],
        diagnostics: [
          {
            pluginId: "matrix",
            message: "manifest without channelConfigs metadata",
          },
        ],
      });

      const { repairMissingConfiguredPluginInstalls } =
        await import("./missing-configured-plugin-install.js");
      const result = await repairMissingConfiguredPluginInstalls({
        cfg: {
          plugins: {
            entries: {
              matrix: { enabled: true },
            },
          },
          channels: {
            matrix: { enabled: true, homeserver: "https://matrix.example.org" },
          },
        },
        env: {},
      });

      expect(mocks.updateNpmInstalledPlugins).not.toHaveBeenCalled();
      expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
      expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
      expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
      expect(result).toEqual({ changes: [], warnings: [], records });
    },
  );

  it("defers missing external payload repair during the package update doctor pass", async () => {
    const records = {
      discord: {
        source: "npm",
        spec: "@daisyclaw/discord",
        installPath: "/missing/discord",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "discord",
        pluginId: "discord",
        meta: { label: "Discord" },
        install: {
          npmSpec: "@daisyclaw/discord",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            discord: { enabled: true },
          },
        },
        channels: {
          discord: { enabled: true },
        },
      },
      env: {
        DAISYCLAW_UPDATE_IN_PROGRESS: "1",
        DAISYCLAW_UPDATE_DEFER_CONFIGURED_PLUGIN_INSTALL_REPAIR: "1",
      },
    });

    expect(mocks.updateNpmInstalledPlugins).not.toHaveBeenCalled();
    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
    expect(result).toEqual({
      changes: [
        'Skipped package-manager repair for configured plugin "discord" during package update; rerun "daisyclaw doctor --fix" after the update completes.',
      ],
      warnings: [],
      records,
    });
  });

  it("updates an existing npm target when stale baseline records miss an installed package", async () => {
    const npmRoot = makeTempDir();
    const packageDir = path.join(npmRoot, "node_modules", "@daisyclaw", "discord");
    fs.mkdirSync(packageDir, { recursive: true });
    mocks.resolveDefaultPluginNpmDir.mockReturnValue(npmRoot);
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "discord",
        pluginId: "discord",
        meta: { label: "Discord" },
        install: {
          npmSpec: "@daisyclaw/discord",
        },
      },
    ]);
    mocks.installPluginFromNpmSpec.mockResolvedValue({
      ok: true,
      pluginId: "discord",
      targetDir: packageDir,
      version: "1.2.3",
      npmResolution: {
        name: "@daisyclaw/discord",
        version: "1.2.3",
        resolvedSpec: "@daisyclaw/discord@1.2.3",
        integrity: "sha512-discord",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            discord: { enabled: true },
          },
        },
        channels: {
          discord: { enabled: true },
        },
      },
      env: {
        DAISYCLAW_UPDATE_POST_CORE_CONVERGENCE: "1",
      },
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@daisyclaw/discord"),
      expectedPluginId: "discord",
      npmDir: npmRoot,
      mode: "update",
    });
    expect(result.changes).toEqual([
      `Installed missing configured plugin "discord" from ${expectedNpmInstallSpec("@daisyclaw/discord")}.`,
    ]);
    expect(result.warnings).toEqual([]);
    expect(result.records.discord?.installPath).toBe(packageDir);
  });

  it("retries npm repair as an update when the install target appears stale", async () => {
    const npmRoot = makeTempDir();
    const packageDir = path.join(npmRoot, "node_modules", "@daisyclaw", "discord");
    mocks.resolveDefaultPluginNpmDir.mockReturnValue(npmRoot);
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "discord",
        pluginId: "discord",
        meta: { label: "Discord" },
        install: {
          npmSpec: "@daisyclaw/discord",
        },
      },
    ]);
    mocks.installPluginFromNpmSpec
      .mockResolvedValueOnce({
        ok: false,
        error: `plugin already exists: ${packageDir} (delete it first)`,
      })
      .mockResolvedValueOnce({
        ok: true,
        pluginId: "discord",
        targetDir: packageDir,
        version: "1.2.3",
        npmResolution: {
          name: "@daisyclaw/discord",
          version: "1.2.3",
          resolvedSpec: "@daisyclaw/discord@1.2.3",
          integrity: "sha512-discord",
          resolvedAt: "2026-05-01T00:00:00.000Z",
        },
      });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            discord: { enabled: true },
          },
        },
      },
      env: {
        DAISYCLAW_UPDATE_POST_CORE_CONVERGENCE: "1",
      },
    });

    expect(mocks.installPluginFromNpmSpec).toHaveBeenCalledTimes(2);
    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec, 0), {
      spec: expectedNpmInstallSpec("@daisyclaw/discord"),
      npmDir: npmRoot,
      mode: "install",
    });
    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec, 1), {
      spec: expectedNpmInstallSpec("@daisyclaw/discord"),
      npmDir: npmRoot,
      mode: "update",
    });
    expect(result.warnings).toEqual([]);
    expect(result.records.discord?.installPath).toBe(packageDir);
  });

  it("prefers an existing npm payload over ClawHub during post-core repair", async () => {
    const npmRoot = makeTempDir();
    const packageDir = path.join(npmRoot, "node_modules", "@daisyclaw", "matrix");
    fs.mkdirSync(packageDir, { recursive: true });
    fs.writeFileSync(
      path.join(packageDir, "package.json"),
      JSON.stringify({ name: "@daisyclaw/matrix", version: "1.2.3" }),
    );
    mocks.resolveDefaultPluginNpmDir.mockReturnValue(npmRoot);
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "matrix",
        pluginId: "matrix",
        meta: { label: "Matrix" },
        install: {
          clawhubSpec: "clawhub:@daisyclaw/matrix",
          npmSpec: "@daisyclaw/matrix",
        },
      },
    ]);
    mocks.installPluginFromClawHub.mockResolvedValue({
      ok: false,
      error: 'Plugin "@daisyclaw/matrix" requires plugin API >=2026.5.18.',
    });
    mocks.installPluginFromNpmSpec.mockResolvedValue({
      ok: true,
      pluginId: "matrix",
      targetDir: packageDir,
      version: "1.2.3",
      npmResolution: {
        name: "@daisyclaw/matrix",
        version: "1.2.3",
        resolvedSpec: "@daisyclaw/matrix@1.2.3",
        integrity: "sha512-matrix",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            matrix: { enabled: true },
          },
        },
        channels: {
          matrix: { enabled: true },
        },
      },
      env: {
        DAISYCLAW_UPDATE_POST_CORE_CONVERGENCE: "1",
      },
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(result.warnings).toEqual([]);
    expectRecordFields(result.records.matrix, {
      source: "npm",
      spec: "@daisyclaw/matrix",
      installPath: packageDir,
      version: "1.2.3",
      resolvedName: "@daisyclaw/matrix",
      resolvedVersion: "1.2.3",
      resolvedSpec: "@daisyclaw/matrix@1.2.3",
    });
  });

  it("passes the post-core compatibility host version to ClawHub repair", async () => {
    const npmRoot = makeTempDir();
    mocks.resolveDefaultPluginNpmDir.mockReturnValue(npmRoot);
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "whatsapp",
        pluginId: "whatsapp",
        meta: { label: "WhatsApp" },
        install: {
          clawhubSpec: "clawhub:@daisyclaw/whatsapp",
          npmSpec: "@daisyclaw/whatsapp",
        },
      },
    ]);
    mocks.installPluginFromClawHub.mockResolvedValue({
      ok: true,
      pluginId: "whatsapp",
      targetDir: "/tmp/daisyclaw-plugins/whatsapp",
      version: "1.2.3",
      clawhub: {
        source: "clawhub",
        clawhubUrl: "https://clawhub.ai",
        clawhubPackage: "@daisyclaw/whatsapp",
        clawhubFamily: "code-plugin",
        clawhubChannel: "official",
        version: "1.2.3",
        integrity: "sha256-whatsapp",
        resolvedAt: "2026-05-01T00:00:00.000Z",
        clawpackSha256: "2".repeat(64),
        clawpackSpecVersion: 1,
        clawpackManifestSha256: "3".repeat(64),
        clawpackSize: 1234,
      },
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            whatsapp: { enabled: true },
          },
        },
        channels: {
          whatsapp: { enabled: true },
        },
      },
      env: {
        DAISYCLAW_COMPATIBILITY_HOST_VERSION: "2026.5.19",
        DAISYCLAW_UPDATE_POST_CORE_CONVERGENCE: "1",
      },
    });

    expectRecordFields(mockCallArg(mocks.installPluginFromClawHub), {
      spec: expectedClawHubInstallSpec("clawhub:@daisyclaw/whatsapp"),
      env: {
        DAISYCLAW_COMPATIBILITY_HOST_VERSION: "2026.5.19",
        DAISYCLAW_UPDATE_POST_CORE_CONVERGENCE: "1",
      },
      mode: "install",
    });
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(result.warnings).toEqual([]);
    expectRecordFields(result.records.whatsapp, {
      source: "clawhub",
      spec: "clawhub:@daisyclaw/whatsapp",
      installPath: "/tmp/daisyclaw-plugins/whatsapp",
      clawhubPackage: "@daisyclaw/whatsapp",
    });
  });

  it("repairs missing external payload during post-core convergence even with DAISYCLAW_UPDATE_IN_PROGRESS=1", async () => {
    const records = {
      discord: {
        source: "npm",
        spec: "@daisyclaw/discord",
        installPath: "/missing/discord",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "discord",
        pluginId: "discord",
        meta: { label: "Discord" },
        install: { npmSpec: "@daisyclaw/discord" },
      },
    ]);
    mocks.updateNpmInstalledPlugins.mockResolvedValue({
      config: {
        plugins: {
          installs: { discord: { source: "npm", installPath: "/repaired/discord" } },
        },
      },
      changed: true,
      outcomes: [{ pluginId: "discord", status: "updated", message: "ok" }],
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: { discord: { enabled: true } },
        },
        channels: {
          discord: { enabled: true },
        },
      },
      env: {
        DAISYCLAW_UPDATE_IN_PROGRESS: "1",
        DAISYCLAW_UPDATE_POST_CORE_CONVERGENCE: "1",
      },
    });

    expect(mocks.updateNpmInstalledPlugins).toHaveBeenCalledTimes(1);
    expect(result.warnings).toEqual([]);
    expect(result.changes[0]).toBe('Repaired missing configured plugin "discord".');
    expectRecordFields(result.records.discord, {
      source: "npm",
      installPath: "/repaired/discord",
    });
  });

  it("defers channel-selected external payload repair during the package update doctor pass", async () => {
    const records = {
      discord: {
        source: "npm",
        spec: "@daisyclaw/discord",
        installPath: "/missing/discord",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "discord",
        pluginId: "discord",
        meta: { label: "Discord" },
        install: {
          npmSpec: "@daisyclaw/discord",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        channels: {
          discord: { enabled: true, token: "secret" },
        },
      },
      env: {
        DAISYCLAW_UPDATE_IN_PROGRESS: "1",
        DAISYCLAW_UPDATE_DEFER_CONFIGURED_PLUGIN_INSTALL_REPAIR: "1",
      },
    });

    expect(mocks.updateNpmInstalledPlugins).not.toHaveBeenCalled();
    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
    expect(result).toEqual({
      changes: [
        'Skipped package-manager repair for configured plugin "discord" during package update; rerun "daisyclaw doctor --fix" after the update completes.',
      ],
      warnings: [],
      records,
    });
  });

  it("does not install channel-selected external plugins during an opted-in package update doctor pass", async () => {
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "discord",
        pluginId: "discord",
        meta: { label: "Discord" },
        install: {
          npmSpec: "@daisyclaw/discord",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        channels: {
          discord: { enabled: true, token: "secret" },
        },
      },
      env: {
        DAISYCLAW_UPDATE_IN_PROGRESS: "1",
        DAISYCLAW_UPDATE_DEFER_CONFIGURED_PLUGIN_INSTALL_REPAIR: "1",
      },
    });

    expect(mocks.updateNpmInstalledPlugins).not.toHaveBeenCalled();
    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
    expect(result).toEqual({ changes: [], warnings: [], records: {} });
  });

  it("installs channel-selected external plugins during a legacy package update doctor pass", async () => {
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "discord",
      targetDir: "/tmp/daisyclaw-plugins/discord",
      version: "2026.5.17",
      npmResolution: {
        name: "@daisyclaw/discord",
        version: "2026.5.17",
        resolvedSpec: "@daisyclaw/discord@2026.5.17",
        integrity: "sha512-discord",
        resolvedAt: "2026-05-17T00:00:00.000Z",
      },
    });
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "discord",
        pluginId: "discord",
        meta: { label: "Discord" },
        install: {
          npmSpec: "@daisyclaw/discord",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        channels: {
          discord: { enabled: true, token: "secret" },
        },
      },
      env: {
        DAISYCLAW_UPDATE_IN_PROGRESS: "1",
      },
    });

    expect(mocks.installPluginFromNpmSpec).toHaveBeenCalledTimes(1);
    expect(result.changes).toEqual([
      `Installed missing configured plugin "discord" from ${expectedNpmInstallSpec("@daisyclaw/discord")}.`,
    ]);
    expectRecordFields(result.records.discord, {
      source: "npm",
      installPath: "/tmp/daisyclaw-plugins/discord",
    });
  });

  it("prefers npm over ClawHub during a legacy package update doctor pass", async () => {
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "whatsapp",
      targetDir: "/tmp/daisyclaw-plugins/whatsapp",
      version: "2026.5.17",
      npmResolution: {
        name: "@daisyclaw/whatsapp",
        version: "2026.5.17",
        resolvedSpec: "@daisyclaw/whatsapp@2026.5.17",
        integrity: "sha512-whatsapp",
        resolvedAt: "2026-05-17T00:00:00.000Z",
      },
    });
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "whatsapp",
        pluginId: "whatsapp",
        meta: { label: "WhatsApp" },
        install: {
          clawhubSpec: "clawhub:@daisyclaw/whatsapp",
          npmSpec: "@daisyclaw/whatsapp",
          defaultChoice: "clawhub",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        channels: {
          whatsapp: { enabled: true, allowFrom: ["+15555550123"] },
        },
      },
      env: {
        DAISYCLAW_UPDATE_IN_PROGRESS: "1",
      },
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@daisyclaw/whatsapp"),
      expectedPluginId: "whatsapp",
    });
    expect(result.changes).toEqual([
      `Installed missing configured plugin "whatsapp" from ${expectedNpmInstallSpec("@daisyclaw/whatsapp")}.`,
    ]);
    expectRecordFields(result.records.whatsapp, {
      source: "npm",
      installPath: "/tmp/daisyclaw-plugins/whatsapp",
    });
  });

  it("keeps ClawHub-only candidates available during a legacy package update doctor pass", async () => {
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "matrix",
        pluginId: "matrix",
        meta: { label: "Matrix" },
        install: {
          clawhubSpec: "clawhub:@daisyclaw/plugin-matrix@stable",
          defaultChoice: "clawhub",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        channels: {
          matrix: { enabled: true, homeserver: "https://matrix.example.org" },
        },
      },
      env: {
        DAISYCLAW_UPDATE_IN_PROGRESS: "1",
      },
    });

    expectRecordFields(mockCallArg(mocks.installPluginFromClawHub), {
      spec: "clawhub:@daisyclaw/plugin-matrix@stable",
      expectedPluginId: "matrix",
    });
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(result.changes).toEqual([
      'Installed missing configured plugin "matrix" from clawhub:@daisyclaw/plugin-matrix@stable.',
    ]);
  });

  it("does not install configured plugins when plugins are globally disabled", async () => {
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "matrix",
        pluginId: "matrix",
        meta: { label: "Matrix" },
        install: {
          npmSpec: "@daisyclaw/plugin-matrix@1.2.3",
        },
      },
    ]);
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "codex",
        label: "Codex",
        install: {
          npmSpec: "@daisyclaw/codex",
          defaultChoice: "npm",
        },
      },
      {
        id: "diagnostics-otel",
        label: "Diagnostics OpenTelemetry",
        install: {
          npmSpec: "@daisyclaw/diagnostics-otel",
          defaultChoice: "npm",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          enabled: false,
          entries: {
            "diagnostics-otel": { enabled: true },
          },
        },
        channels: {
          matrix: { homeserver: "https://matrix.example.org" },
        },
        agents: {
          defaults: {
            agentRuntime: { id: "codex" },
          },
        },
      },
      env: {},
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
    expect(result).toEqual({ changes: [], warnings: [], records: {} });
  });

  it("does not install plugins merely listed in plugins.allow", async () => {
    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          allow: ["codex"],
        },
      },
      env: {},
    });

    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
    expect(result).toEqual({ changes: [], warnings: [], records: {} });
  });

  it("installs a missing third-party downloadable plugin from npm only", async () => {
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "wecom",
      targetDir: "/tmp/daisyclaw-plugins/wecom",
      version: "2026.4.23",
      npmResolution: {
        name: "@wecom/wecom-daisyclaw-plugin",
        version: "2026.4.23",
        resolvedSpec: "@wecom/wecom-daisyclaw-plugin@2026.4.23",
        integrity: "sha512-third-party",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "wecom",
        pluginId: "wecom",
        meta: { label: "WeCom" },
        install: {
          npmSpec: "@wecom/wecom-daisyclaw-plugin@2026.4.23",
        },
      },
    ]);

    const { repairMissingPluginInstallsForIds } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingPluginInstallsForIds({
      cfg: {},
      pluginIds: [],
      channelIds: ["wecom"],
      env: {},
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    const installArg = mockCallArg(mocks.installPluginFromNpmSpec);
    expectRecordFields(installArg, {
      spec: "@wecom/wecom-daisyclaw-plugin@2026.4.23",
      expectedPluginId: "wecom",
    });
    expect(installArg).not.toHaveProperty("trustedSourceLinkedOfficialInstall", true);
    expect(result.changes).toEqual([
      'Installed missing configured plugin "wecom" from @wecom/wecom-daisyclaw-plugin@2026.4.23.',
    ]);
  });

  it("installs a missing default Codex runtime plugin from the official external catalog", async () => {
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "codex",
      targetDir: "/tmp/daisyclaw-plugins/codex",
      version: "2026.5.2",
      npmResolution: {
        name: "@daisyclaw/codex",
        version: "2026.5.2",
        resolvedSpec: "@daisyclaw/codex@2026.5.2",
        integrity: "sha512-codex",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "codex",
        label: "Codex",
        install: {
          npmSpec: "@daisyclaw/codex",
          defaultChoice: "npm",
        },
      },
    ]);

    const { repairMissingPluginInstallsForIds } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingPluginInstallsForIds({
      cfg: {
        agents: {
          defaults: {
            model: "openai/gpt-5.4",
            agentRuntime: { id: "codex" },
          },
        },
      },
      pluginIds: ["codex"],
      env: {},
    });

    expect(mocks.resolveProviderInstallCatalogEntries).toHaveBeenCalled();
    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@daisyclaw/codex"),
      expectedPluginId: "codex",
      trustedSourceLinkedOfficialInstall: true,
    });
    const records = mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords);
    expectRecordFields((records as Record<string, unknown>).codex, {
      source: "npm",
      spec: "@daisyclaw/codex@2026.5.2",
      installPath: "/tmp/daisyclaw-plugins/codex",
      version: "2026.5.2",
    });
    expect(mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords, 0, 1)).toEqual({
      env: {},
    });
    expect(result.changes).toEqual([
      `Installed missing configured plugin "codex" from ${expectedNpmInstallSpec("@daisyclaw/codex")}.`,
    ]);
    expect(result.warnings).toStrictEqual([]);
  });

  it("refreshes a stale managed Codex runtime plugin selected by the OpenAI Codex route", async () => {
    const installDir = makeTempDir();
    fs.writeFileSync(
      path.join(installDir, "package.json"),
      JSON.stringify({ name: "@daisyclaw/codex", version: "2026.5.6" }),
    );
    const records = {
      codex: {
        source: "npm",
        spec: "@daisyclaw/codex",
        resolvedName: "@daisyclaw/codex",
        resolvedSpec: "@daisyclaw/codex@2026.5.6",
        resolvedVersion: "2026.5.6",
        version: "2026.5.6",
        integrity: "sha512-old-codex",
        installPath: installDir,
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [
        {
          id: "codex",
          packageVersion: "2026.5.6",
          providers: ["codex"],
        },
      ],
      diagnostics: [],
      byPluginId: new Map([
        [
          "codex",
          {
            id: "codex",
            packageVersion: "2026.5.6",
            providers: ["codex"],
          },
        ],
      ]),
    });
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "codex",
      targetDir: "/tmp/daisyclaw-plugins/codex",
      version: VERSION,
      npmResolution: {
        name: "@daisyclaw/codex",
        version: VERSION,
        resolvedSpec: `@daisyclaw/codex@${VERSION}`,
        integrity: "sha512-new-codex",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "codex",
        label: "Codex",
        install: {
          npmSpec: "@daisyclaw/codex",
          defaultChoice: "npm",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        agents: {
          defaults: {
            model: "openai/gpt-5.5",
          },
        },
      },
      env: {},
    });

    expect(mocks.updateNpmInstalledPlugins).not.toHaveBeenCalled();
    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@daisyclaw/codex"),
      expectedPluginId: "codex",
      trustedSourceLinkedOfficialInstall: true,
      mode: "update",
    });
    expect(result.changes).toEqual([
      `Refreshed stale configured plugin "codex" from ${expectedNpmInstallSpec("@daisyclaw/codex")}.`,
    ]);
    expectRecordFields(result.records.codex, {
      source: "npm",
      spec: `@daisyclaw/codex@${VERSION}`,
      installPath: "/tmp/daisyclaw-plugins/codex",
      version: VERSION,
      resolvedName: "@daisyclaw/codex",
      resolvedVersion: VERSION,
      resolvedSpec: `@daisyclaw/codex@${VERSION}`,
    });
  });

  it("does not refresh a converged beta Codex runtime plugin on the second doctor pass", async () => {
    const codexBetaVersion = `${currentDaisyClawReleaseBase()}-beta.4`;
    const installDir = makeTempDir();
    fs.writeFileSync(
      path.join(installDir, "package.json"),
      JSON.stringify({ name: "@daisyclaw/codex", version: "2026.5.6" }),
    );
    const records = {
      codex: {
        source: "npm",
        spec: "@daisyclaw/codex",
        resolvedName: "@daisyclaw/codex",
        resolvedSpec: "@daisyclaw/codex@2026.5.6",
        resolvedVersion: "2026.5.6",
        version: "2026.5.6",
        integrity: "sha512-old-codex",
        installPath: installDir,
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [
        {
          id: "codex",
          packageVersion: "2026.5.6",
          providers: ["codex"],
        },
      ],
      diagnostics: [],
      byPluginId: new Map([
        [
          "codex",
          {
            id: "codex",
            packageVersion: "2026.5.6",
            providers: ["codex"],
          },
        ],
      ]),
    });
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "codex",
      targetDir: installDir,
      version: codexBetaVersion,
      npmResolution: {
        name: "@daisyclaw/codex",
        version: codexBetaVersion,
        resolvedSpec: `@daisyclaw/codex@${codexBetaVersion}`,
        integrity: "sha512-new-codex-beta",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "codex",
        label: "Codex",
        install: {
          npmSpec: "@daisyclaw/codex",
          defaultChoice: "npm",
        },
      },
    ]);

    const cfg = {
      update: { channel: "beta" as const },
      agents: {
        defaults: {
          model: "openai/gpt-5.5",
        },
      },
    };
    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const firstPass = await repairMissingConfiguredPluginInstalls({
      cfg,
      env: {},
    });

    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: "@daisyclaw/codex@beta",
      expectedPluginId: "codex",
      trustedSourceLinkedOfficialInstall: true,
      mode: "update",
    });
    expect(firstPass.changes).toEqual([
      'Refreshed stale configured plugin "codex" from @daisyclaw/codex@beta.',
    ]);
    expectRecordFields(firstPass.records.codex, {
      source: "npm",
      spec: `@daisyclaw/codex@${codexBetaVersion}`,
      installPath: installDir,
      version: codexBetaVersion,
      resolvedName: "@daisyclaw/codex",
      resolvedVersion: codexBetaVersion,
      resolvedSpec: `@daisyclaw/codex@${codexBetaVersion}`,
    });

    mocks.installPluginFromNpmSpec.mockClear();
    mocks.writePersistedInstalledPluginIndexInstallRecords.mockClear();
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValueOnce(firstPass.records);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [
        {
          id: "codex",
          packageVersion: codexBetaVersion,
          providers: ["codex"],
        },
      ],
      diagnostics: [],
      byPluginId: new Map([
        [
          "codex",
          {
            id: "codex",
            packageVersion: codexBetaVersion,
            providers: ["codex"],
          },
        ],
      ]),
    });

    const secondPass = await repairMissingConfiguredPluginInstalls({
      cfg,
      env: {},
    });

    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
    expect(secondPass).toEqual({ changes: [], warnings: [], records: firstPass.records });
  });

  it("does not downgrade a newer managed Codex runtime plugin", async () => {
    const installDir = makeTempDir();
    fs.writeFileSync(
      path.join(installDir, "package.json"),
      JSON.stringify({ name: "@daisyclaw/codex", version: "9999.1.1" }),
    );
    const records = {
      codex: {
        source: "npm",
        spec: "@daisyclaw/codex",
        resolvedName: "@daisyclaw/codex",
        resolvedSpec: "@daisyclaw/codex@9999.1.1",
        resolvedVersion: "9999.1.1",
        version: "9999.1.1",
        integrity: "sha512-newer-codex",
        installPath: installDir,
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [
        {
          id: "codex",
          packageVersion: "9999.1.1",
          providers: ["codex", "openai-codex", "openai"],
        },
      ],
      diagnostics: [],
      byPluginId: new Map([
        [
          "codex",
          {
            id: "codex",
            packageVersion: "9999.1.1",
            providers: ["codex", "openai-codex", "openai"],
          },
        ],
      ]),
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        agents: {
          defaults: {
            model: "openai/gpt-5.5",
          },
        },
      },
      env: {},
    });

    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
    expect(result).toEqual({ changes: [], warnings: [], records });
  });

  it.each([
    [
      "default OpenAI model route",
      {
        agents: {
          defaults: {
            model: "openai/gpt-5.5",
          },
        },
      },
      {},
    ],
    [
      "provider runtime policy",
      {
        models: {
          providers: {
            openai: {
              baseUrl: "https://api.openai.com/v1",
              agentRuntime: { id: "codex" },
              models: [],
            },
          },
        },
      },
      {},
    ],
    [
      "default model runtime policy",
      {
        agents: {
          defaults: {
            models: {
              "openai/gpt-5.5": { agentRuntime: { id: "codex" } },
            },
          },
        },
      },
      {},
    ],
    [
      "default selectable OpenAI agent model",
      {
        agents: {
          defaults: {
            model: { primary: "anthropic/claude-sonnet-4-6" },
            models: {
              "openai/gpt-5.5": {},
            },
          },
        },
      },
      {},
    ],
    [
      "agent model runtime policy",
      {
        agents: {
          list: [
            {
              id: "main",
              model: "anthropic/claude-opus-4-7",
              models: {
                "anthropic/claude-opus-4-7": { agentRuntime: { id: "codex" } },
              },
            },
          ],
        },
      },
      {},
    ],
  ])("repairs a missing Codex plugin selected by %s", async (_label, cfg, env) => {
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "codex",
      targetDir: "/tmp/daisyclaw-plugins/codex",
      version: "2026.5.2",
      npmResolution: {
        name: "@daisyclaw/codex",
        version: "2026.5.2",
        resolvedSpec: "@daisyclaw/codex@2026.5.2",
        integrity: "sha512-codex",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "codex",
        label: "Codex",
        install: {
          npmSpec: "@daisyclaw/codex",
          defaultChoice: "npm",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg,
      env,
    });

    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@daisyclaw/codex"),
      expectedPluginId: "codex",
      trustedSourceLinkedOfficialInstall: true,
    });
    const records = mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords);
    expectRecordFields((records as Record<string, unknown>).codex, {
      source: "npm",
      spec: "@daisyclaw/codex@2026.5.2",
      installPath: "/tmp/daisyclaw-plugins/codex",
      version: "2026.5.2",
    });
    expect(mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords, 0, 1)).toEqual({
      env,
    });
    expect(result.changes).toEqual([
      `Installed missing configured plugin "codex" from ${expectedNpmInstallSpec("@daisyclaw/codex")}.`,
    ]);
    expect(result.warnings).toEqual([]);
    expect(Object.keys(result.records)).toEqual(["codex"]);
    expectRecordFields(result.records.codex, {
      source: "npm",
      spec: "@daisyclaw/codex@2026.5.2",
      installPath: "/tmp/daisyclaw-plugins/codex",
      version: "2026.5.2",
      resolvedName: "@daisyclaw/codex",
      resolvedSpec: "@daisyclaw/codex@2026.5.2",
      integrity: "sha512-codex",
      resolvedAt: "2026-05-01T00:00:00.000Z",
    });
    expect(typeof result.records.codex?.installedAt).toBe("string");
  });

  it.each([
    [
      "default agent runtime",
      {
        agents: {
          defaults: {
            agentRuntime: { id: "codex" },
          },
        },
      },
      {},
    ],
    [
      "agent runtime override",
      {
        agents: {
          list: [{ id: "main", agentRuntime: { id: "codex" } }],
        },
      },
      {},
    ],
    ["environment runtime override", {}, { DAISYCLAW_AGENT_RUNTIME: "codex" }],
  ])("ignores legacy whole-agent Codex runtime selected by %s", async (_label, cfg, env) => {
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "codex",
        label: "Codex",
        install: {
          npmSpec: "@daisyclaw/codex",
          defaultChoice: "npm",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg,
      env,
    });

    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
    expect(result).toEqual({ changes: [], warnings: [], records: {} });
  });

  it("does not install a blocked downloadable plugin from explicit channel ids", async () => {
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "matrix",
        pluginId: "matrix",
        meta: { label: "Matrix" },
        install: {
          npmSpec: "@daisyclaw/plugin-matrix@1.2.3",
        },
      },
    ]);

    const { repairMissingPluginInstallsForIds } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingPluginInstallsForIds({
      cfg: {},
      pluginIds: [],
      channelIds: ["matrix"],
      blockedPluginIds: ["matrix"],
      env: {},
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(result).toEqual({ changes: [], warnings: [], records: {} });
  });

  it("does not install a channel catalog plugin when a configured plugin already owns that channel", async () => {
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [
        {
          id: "daisyclaw-lark",
          origin: "config",
          channels: ["feishu"],
          channelConfigs: {
            feishu: {
              schema: {
                type: "object",
              },
            },
          },
        },
      ],
      diagnostics: [],
    });
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "feishu",
        pluginId: "feishu",
        meta: { label: "Feishu" },
        install: {
          npmSpec: "@daisyclaw/feishu",
        },
        trustedSourceLinkedOfficialInstall: true,
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            "daisyclaw-lark": {
              enabled: true,
            },
          },
        },
        channels: {
          feishu: {
            footer: {
              model: false,
            },
          },
        },
      },
      env: {},
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
    expect(result).toEqual({ changes: [], warnings: [], records: {} });
  });

  it("still installs a channel catalog plugin when the configured owner is blocked by the allowlist", async () => {
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [
        {
          id: "daisyclaw-lark",
          origin: "config",
          channels: ["feishu"],
          channelConfigs: {
            feishu: {
              schema: {
                type: "object",
              },
            },
          },
        },
      ],
      diagnostics: [],
    });
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "feishu",
        pluginId: "feishu",
        meta: { label: "Feishu" },
        install: {
          npmSpec: "@daisyclaw/feishu",
        },
        trustedSourceLinkedOfficialInstall: true,
      },
    ]);
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "feishu",
      targetDir: "/tmp/daisyclaw-plugins/feishu",
      version: "2026.5.2",
      npmResolution: {
        name: "@daisyclaw/feishu",
        version: "2026.5.2",
        resolvedSpec: "@daisyclaw/feishu@2026.5.2",
      },
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          allow: ["some-other-plugin"],
          entries: {
            "daisyclaw-lark": {
              enabled: true,
            },
          },
        },
        channels: {
          feishu: {
            footer: {
              model: false,
            },
          },
        },
      },
      env: {},
    });

    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@daisyclaw/feishu"),
      expectedPluginId: "feishu",
      trustedSourceLinkedOfficialInstall: true,
    });
    expect(result.changes).toEqual([
      `Installed missing configured plugin "feishu" from ${expectedNpmInstallSpec("@daisyclaw/feishu")}.`,
    ]);
  });

  it("still installs a channel catalog plugin when that plugin is explicitly configured", async () => {
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [
        {
          id: "daisyclaw-lark",
          origin: "config",
          channels: ["feishu"],
          channelConfigs: {
            feishu: {
              schema: {
                type: "object",
              },
            },
          },
        },
      ],
      diagnostics: [],
    });
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "feishu",
        pluginId: "feishu",
        meta: { label: "Feishu" },
        install: {
          npmSpec: "@daisyclaw/feishu",
        },
        trustedSourceLinkedOfficialInstall: true,
      },
    ]);
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "feishu",
      targetDir: "/tmp/daisyclaw-plugins/feishu",
      version: "2026.5.2",
      npmResolution: {
        name: "@daisyclaw/feishu",
        version: "2026.5.2",
        resolvedSpec: "@daisyclaw/feishu@2026.5.2",
      },
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            feishu: {
              enabled: true,
            },
            "daisyclaw-lark": {
              enabled: true,
            },
          },
        },
        channels: {
          feishu: {
            footer: {
              model: false,
            },
          },
        },
      },
      env: {},
    });

    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@daisyclaw/feishu"),
      expectedPluginId: "feishu",
      trustedSourceLinkedOfficialInstall: true,
    });
    expect(result.changes).toEqual([
      `Installed missing configured plugin "feishu" from ${expectedNpmInstallSpec("@daisyclaw/feishu")}.`,
    ]);
  });

  it("reinstalls a missing configured plugin from its persisted install record", async () => {
    const records = {
      demo: {
        source: "npm",
        spec: "@daisyclaw/plugin-demo@1.0.0",
        installPath: "/missing/demo",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.updateNpmInstalledPlugins.mockResolvedValue({
      changed: true,
      config: {
        plugins: {
          installs: {
            demo: {
              source: "npm",
              spec: "@daisyclaw/plugin-demo@1.0.0",
              installPath: "/tmp/daisyclaw-plugins/demo",
            },
          },
        },
      },
      outcomes: [
        {
          pluginId: "demo",
          status: "updated",
          message: "Updated demo.",
        },
      ],
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            demo: { enabled: true },
          },
        },
      },
      env: {},
    });

    const updateArg = expectRecordFields(mockCallArg(mocks.updateNpmInstalledPlugins), {
      pluginIds: ["demo"],
    });
    const updateConfig = updateArg.config as Record<string, unknown>;
    expectRecordFields(updateConfig.plugins, { installs: records });
    const persistedRecords = mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords);
    expectRecordFields((persistedRecords as Record<string, unknown>).demo, {
      installPath: "/tmp/daisyclaw-plugins/demo",
    });
    expect(mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords, 0, 1)).toEqual({
      env: {},
    });
    expect(result.changes).toEqual(['Repaired missing configured plugin "demo".']);
  });

  it("repairs a broken managed package entry from its attributed registry diagnostic", async () => {
    const records = {
      demo: {
        source: "npm",
        spec: "@daisyclaw/plugin-demo@1.0.0",
        resolvedName: "@daisyclaw/plugin-demo",
        resolvedSpec: "@daisyclaw/plugin-demo@1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-demo",
        installPath: "/tmp/daisyclaw-plugins/demo",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [],
      diagnostics: [
        {
          level: "error",
          pluginId: "demo",
          message: "extension entry escapes package directory: ./index.ts",
        },
      ],
    });
    mocks.updateNpmInstalledPlugins.mockResolvedValue({
      changed: true,
      config: {
        plugins: {
          installs: {
            demo: {
              source: "npm",
              spec: "@daisyclaw/plugin-demo@1.0.0",
              installPath: "/tmp/daisyclaw-plugins/demo",
            },
          },
        },
      },
      outcomes: [
        {
          pluginId: "demo",
          status: "updated",
          message: "Updated demo.",
        },
      ],
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {},
      env: {},
    });

    const updateArg = expectRecordFields(mockCallArg(mocks.updateNpmInstalledPlugins), {
      pluginIds: ["demo"],
    });
    const updateConfig = updateArg.config as { plugins?: { installs?: Record<string, unknown> } };
    const updateRecord = expectRecordFields(updateConfig.plugins?.installs?.demo, {
      source: "npm",
      spec: "@daisyclaw/plugin-demo@1.0.0",
      integrity: "sha512-demo",
      installPath: "/tmp/daisyclaw-plugins/demo",
    });
    expect(updateRecord.resolvedSpec).toBeUndefined();
    expect(updateRecord.resolvedVersion).toBeUndefined();
    expect(result.changes).toEqual(['Repaired broken installed plugin "demo".']);
  });

  it("reinstalls a known configured plugin from the catalog when its recorded install path is missing", async () => {
    const records = {
      discord: {
        source: "npm",
        spec: "@daisyclaw/discord",
        installPath: "/tmp/daisyclaw-missing-discord-install-record",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [
        {
          id: "discord",
          channels: ["discord"],
        },
      ],
      diagnostics: [],
    });
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "discord",
        pluginId: "discord",
        meta: { label: "Discord" },
        install: {
          npmSpec: "@daisyclaw/discord",
        },
        trustedSourceLinkedOfficialInstall: true,
      },
    ]);
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "discord",
      targetDir: "/tmp/daisyclaw-plugins/discord",
      version: "1.2.3",
      npmResolution: {
        name: "@daisyclaw/discord",
        version: "1.2.3",
        resolvedSpec: "@daisyclaw/discord@1.2.3",
        integrity: "sha512-discord",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });
    mocks.updateNpmInstalledPlugins.mockResolvedValue({
      changed: false,
      config: {
        plugins: {
          installs: records,
        },
      },
      outcomes: [
        {
          pluginId: "discord",
          status: "skipped",
          message: "No update applied.",
        },
      ],
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            discord: { enabled: true },
          },
        },
        channels: {
          discord: { enabled: true },
        },
      },
      env: {},
    });

    const updateArg = expectRecordFields(mockCallArg(mocks.updateNpmInstalledPlugins), {
      pluginIds: ["discord"],
    });
    const updateConfig = updateArg.config as Record<string, unknown>;
    expectRecordFields(updateConfig.plugins, { installs: records });
    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@daisyclaw/discord"),
      expectedPluginId: "discord",
      trustedSourceLinkedOfficialInstall: true,
    });
    const persistedRecords = mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords);
    expectRecordFields((persistedRecords as Record<string, unknown>).discord, {
      spec: "@daisyclaw/discord@1.2.3",
      installPath: "/tmp/daisyclaw-plugins/discord",
    });
    expect(mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords, 0, 1)).toEqual({
      env: {},
    });
    expect(result.changes).toEqual([
      `Installed missing configured plugin "discord" from ${expectedNpmInstallSpec("@daisyclaw/discord")}.`,
    ]);
  });

  it("updates a known configured plugin when its installed manifest path still exists", async () => {
    const records = {
      discord: {
        source: "npm",
        spec: "@daisyclaw/discord",
        installPath: process.cwd(),
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [
        {
          id: "discord",
          channels: ["discord"],
        },
      ],
      diagnostics: [
        {
          pluginId: "discord",
          message: "manifest without channelConfigs metadata",
        },
      ],
    });
    mocks.updateNpmInstalledPlugins.mockResolvedValue({
      changed: true,
      config: {
        plugins: {
          installs: {
            discord: {
              source: "npm",
              spec: "@daisyclaw/discord",
              installPath: process.cwd(),
            },
          },
        },
      },
      outcomes: [
        {
          pluginId: "discord",
          status: "updated",
          message: "Updated discord.",
        },
      ],
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            discord: { enabled: true },
          },
        },
        channels: {
          discord: { enabled: true },
        },
      },
      env: {},
    });

    const updateArg = expectRecordFields(mockCallArg(mocks.updateNpmInstalledPlugins), {
      pluginIds: ["discord"],
    });
    const updateConfig = updateArg.config as Record<string, unknown>;
    expectRecordFields(updateConfig.plugins, { installs: records });
    const persistedRecords = mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords);
    expectRecordFields((persistedRecords as Record<string, unknown>).discord, {
      installPath: process.cwd(),
    });
    expect(mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords, 0, 1)).toEqual({
      env: {},
    });
    expect(result.changes).toEqual(['Repaired missing configured plugin "discord".']);
  });

  it("updates a configured plugin when its installed manifest lacks channel config descriptors", async () => {
    const records = {
      discord: {
        source: "npm",
        spec: "@daisyclaw/discord",
        installPath: "/tmp/daisyclaw-plugins/discord",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "discord",
        pluginId: "discord",
        meta: { label: "Discord" },
        install: {
          npmSpec: "@daisyclaw/discord",
        },
      },
    ]);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [
        {
          id: "discord",
          channels: ["discord"],
        },
      ],
      diagnostics: [
        {
          level: "warn",
          pluginId: "discord",
          message:
            "channel plugin manifest declares discord without channelConfigs metadata; add daisyclaw.plugin.json#channelConfigs so config schema and setup surfaces work before runtime loads",
        },
      ],
    });
    mocks.updateNpmInstalledPlugins.mockResolvedValue({
      changed: true,
      config: {
        plugins: {
          installs: {
            discord: {
              source: "npm",
              spec: "@daisyclaw/discord",
              installPath: process.cwd(),
            },
          },
        },
      },
      outcomes: [
        {
          pluginId: "discord",
          status: "updated",
          message: "Updated discord.",
        },
      ],
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        update: { channel: "beta" },
        plugins: {
          entries: {
            discord: { enabled: true },
          },
        },
        channels: {
          discord: { enabled: true },
        },
      },
      env: {},
    });

    const updateArg = expectRecordFields(mockCallArg(mocks.updateNpmInstalledPlugins), {
      pluginIds: ["discord"],
      updateChannel: "beta",
    });
    const updateConfig = updateArg.config as Record<string, unknown>;
    expectRecordFields(updateConfig.plugins, { installs: records });
    const persistedRecords = mockCallArg(
      mocks.writePersistedInstalledPluginIndexInstallRecords,
    ) as Record<string, unknown>;
    expectRecordFields(persistedRecords.discord, { installPath: process.cwd() });
    expect(mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords, 0, 1)).toEqual({
      env: {},
    });
    expect(result).toEqual({
      changes: ['Repaired missing configured plugin "discord".'],
      warnings: [],
      records: {
        discord: {
          source: "npm",
          spec: "@daisyclaw/discord",
          installPath: process.cwd(),
        },
      },
    });
  });

  it("reinstalls a recorded external web search plugin from provider-only config", async () => {
    const records = {
      brave: {
        source: "npm",
        spec: "@daisyclaw/brave-plugin@beta",
        installPath: "/missing/brave",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "brave",
        label: "Brave",
        install: {
          npmSpec: "@daisyclaw/brave-plugin",
          defaultChoice: "npm",
        },
        daisyclaw: {
          plugin: { id: "brave", label: "Brave" },
          webSearchProviders: [
            {
              id: "brave",
              label: "Brave Search",
              hint: "Brave Search",
              envVars: ["BRAVE_API_KEY"],
              placeholder: "BSA...",
              signupUrl: "https://example.test/brave",
            },
          ],
        },
      },
    ]);
    mocks.updateNpmInstalledPlugins.mockResolvedValue({
      changed: true,
      config: {
        plugins: {
          installs: {
            brave: {
              source: "npm",
              spec: "@daisyclaw/brave-plugin@beta",
              installPath: process.cwd(),
            },
          },
        },
      },
      outcomes: [
        {
          pluginId: "brave",
          status: "updated",
          message: "Updated brave.",
        },
      ],
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        tools: {
          web: {
            search: {
              provider: "brave",
            },
          },
        },
      },
      env: {},
    });

    const updateArg = expectRecordFields(mockCallArg(mocks.updateNpmInstalledPlugins), {
      pluginIds: ["brave"],
    });
    const updateConfig = updateArg.config as Record<string, unknown>;
    expectRecordFields(updateConfig.plugins, { installs: records });
    const persistedRecords = mockCallArg(
      mocks.writePersistedInstalledPluginIndexInstallRecords,
    ) as Record<string, unknown>;
    expectRecordFields(persistedRecords.brave, { installPath: process.cwd() });
    expect(mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords, 0, 1)).toEqual({
      env: {},
    });
    expect(result.changes).toEqual(['Repaired missing configured plugin "brave".']);
  });

  it("replaces a configured official web search plugin when its installed package is source-only", async () => {
    const extensionsDir = path.join(makeTempDir(), "extensions");
    const installDir = path.join(extensionsDir, "brave");
    mocks.resolveDefaultPluginExtensionsDir.mockReturnValue(extensionsDir);
    fs.mkdirSync(installDir, { recursive: true });
    fs.writeFileSync(path.join(installDir, "package.json"), JSON.stringify({ name: "brave" }));
    const records = {
      brave: {
        source: "clawhub",
        spec: "clawhub:@daisyclaw/brave-plugin@2026.5.1-beta.1",
        installPath: installDir,
        clawhubPackage: "@daisyclaw/brave-plugin",
        clawhubChannel: "official",
        clawhubUrl: "https://clawhub.ai",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [],
      diagnostics: [
        {
          level: "error",
          pluginId: "brave",
          message:
            "installed plugin package requires compiled runtime output for TypeScript entry index.ts: expected ./dist/index.js, ./dist/index.mjs, ./dist/index.cjs, index.js, index.mjs, index.cjs.",
        },
      ],
    });
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "brave",
        label: "Brave",
        install: {
          npmSpec: "@daisyclaw/brave-plugin",
          defaultChoice: "npm",
        },
        daisyclaw: {
          plugin: { id: "brave", label: "Brave" },
          webSearchProviders: [
            {
              id: "brave",
              label: "Brave Search",
              hint: "Brave Search",
              envVars: ["BRAVE_API_KEY"],
              placeholder: "BSA...",
              signupUrl: "https://example.test/brave",
            },
          ],
        },
      },
    ]);
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "brave",
      targetDir: "/tmp/daisyclaw-plugins/brave",
      version: "2026.5.12",
      npmResolution: {
        name: "@daisyclaw/brave-plugin",
        version: "2026.5.12",
        resolvedSpec: "@daisyclaw/brave-plugin@2026.5.12",
        integrity: "sha512-brave",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        tools: {
          web: {
            search: {
              provider: "brave",
            },
          },
        },
      },
      env: {},
    });

    expect(mocks.updateNpmInstalledPlugins).not.toHaveBeenCalled();
    expect(fs.existsSync(installDir)).toBe(false);
    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@daisyclaw/brave-plugin"),
      expectedPluginId: "brave",
      trustedSourceLinkedOfficialInstall: true,
      mode: "update",
    });
    const persistedRecords = mockCallArg(
      mocks.writePersistedInstalledPluginIndexInstallRecords,
    ) as Record<string, unknown>;
    expectRecordFields(persistedRecords.brave, {
      source: "npm",
      spec: "@daisyclaw/brave-plugin@2026.5.12",
      installPath: "/tmp/daisyclaw-plugins/brave",
      version: "2026.5.12",
    });
    expect(result).toEqual({
      changes: [
        `Installed missing configured plugin "brave" from ${expectedNpmInstallSpec("@daisyclaw/brave-plugin")}.`,
      ],
      warnings: [],
      records: persistedRecords,
    });
  });

  it("replaces a configured official channel plugin when only its channel is configured", async () => {
    const extensionsDir = path.join(makeTempDir(), "extensions");
    const installDir = path.join(extensionsDir, "slack");
    mocks.resolveDefaultPluginExtensionsDir.mockReturnValue(extensionsDir);
    fs.mkdirSync(installDir, { recursive: true });
    fs.writeFileSync(path.join(installDir, "package.json"), JSON.stringify({ name: "slack" }));
    const records = {
      slack: {
        source: "clawhub",
        spec: "clawhub:@daisyclaw/slack@2026.5.12-beta.1",
        installPath: installDir,
        clawhubPackage: "@daisyclaw/slack",
        clawhubChannel: "official",
        clawhubUrl: "https://clawhub.ai",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [],
      diagnostics: [
        {
          level: "error",
          pluginId: "slack",
          message:
            "installed plugin package requires compiled runtime output for TypeScript entry index.ts: expected ./dist/index.js.",
        },
      ],
    });
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "slack",
        pluginId: "slack",
        meta: { label: "Slack" },
        install: {
          npmSpec: "@daisyclaw/slack",
          defaultChoice: "npm",
        },
        trustedSourceLinkedOfficialInstall: true,
      },
    ]);
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "slack",
      targetDir: "/tmp/daisyclaw-npm/node_modules/@daisyclaw/slack",
      version: "2026.5.12",
      npmResolution: {
        name: "@daisyclaw/slack",
        version: "2026.5.12",
        resolvedSpec: "@daisyclaw/slack@2026.5.12",
        integrity: "sha512-slack",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        channels: {
          slack: {
            enabled: true,
            botToken: "xoxb-test",
          },
        },
      },
      env: {},
    });

    expect(mocks.updateNpmInstalledPlugins).not.toHaveBeenCalled();
    expect(fs.existsSync(installDir)).toBe(false);
    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@daisyclaw/slack"),
      expectedPluginId: "slack",
      trustedSourceLinkedOfficialInstall: true,
      mode: "update",
    });
    expect(result.changes).toEqual([
      `Installed missing configured plugin "slack" from ${expectedNpmInstallSpec("@daisyclaw/slack")}.`,
    ]);
  });

  it("does not delete an arbitrary recorded path when replacing a broken official plugin", async () => {
    const installDir = makeTempDir();
    fs.writeFileSync(path.join(installDir, "package.json"), JSON.stringify({ name: "brave" }));
    const records = {
      brave: {
        source: "clawhub",
        spec: "clawhub:@daisyclaw/brave-plugin@2026.5.1-beta.1",
        installPath: installDir,
        clawhubPackage: "@daisyclaw/brave-plugin",
        clawhubChannel: "official",
        clawhubUrl: "https://clawhub.ai",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [],
      diagnostics: [
        {
          level: "error",
          pluginId: "brave",
          message:
            "installed plugin package requires compiled runtime output for TypeScript entry index.ts: expected ./dist/index.js.",
        },
      ],
    });
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "brave",
        label: "Brave",
        install: {
          npmSpec: "@daisyclaw/brave-plugin",
          defaultChoice: "npm",
        },
        daisyclaw: {
          plugin: { id: "brave", label: "Brave" },
          webSearchProviders: [
            {
              id: "brave",
              label: "Brave Search",
              hint: "Brave Search",
              envVars: ["BRAVE_API_KEY"],
              placeholder: "BSA...",
              signupUrl: "https://example.test/brave",
            },
          ],
        },
      },
    ]);
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "brave",
      targetDir: "/tmp/daisyclaw-plugins/brave",
      version: "2026.5.12",
      npmResolution: {
        name: "@daisyclaw/brave-plugin",
        version: "2026.5.12",
        resolvedSpec: "@daisyclaw/brave-plugin@2026.5.12",
        integrity: "sha512-brave",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    await repairMissingConfiguredPluginInstalls({
      cfg: {
        tools: {
          web: {
            search: {
              provider: "brave",
            },
          },
        },
      },
      env: {},
    });

    expect(fs.existsSync(installDir)).toBe(true);
    expect(mocks.installPluginFromNpmSpec).toHaveBeenCalled();
  });

  it("keeps a broken official install record when replacement install fails", async () => {
    const extensionsDir = path.join(makeTempDir(), "extensions");
    const installDir = path.join(extensionsDir, "brave");
    mocks.resolveDefaultPluginExtensionsDir.mockReturnValue(extensionsDir);
    fs.mkdirSync(installDir, { recursive: true });
    fs.writeFileSync(path.join(installDir, "package.json"), JSON.stringify({ name: "brave" }));
    const records = {
      brave: {
        source: "clawhub",
        spec: "clawhub:@daisyclaw/brave-plugin@2026.5.1-beta.1",
        installPath: installDir,
        clawhubPackage: "@daisyclaw/brave-plugin",
        clawhubChannel: "official",
        clawhubUrl: "https://clawhub.ai",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [],
      diagnostics: [
        {
          level: "error",
          pluginId: "brave",
          message:
            "installed plugin package requires compiled runtime output for TypeScript entry index.ts: expected ./dist/index.js.",
        },
      ],
    });
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "brave",
        label: "Brave",
        install: {
          npmSpec: "@daisyclaw/brave-plugin",
          defaultChoice: "npm",
        },
        daisyclaw: {
          plugin: { id: "brave", label: "Brave" },
          webSearchProviders: [
            {
              id: "brave",
              label: "Brave Search",
              hint: "Brave Search",
              envVars: ["BRAVE_API_KEY"],
              placeholder: "BSA...",
              signupUrl: "https://example.test/brave",
            },
          ],
        },
      },
    ]);
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: false,
      error: "network unavailable",
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        tools: {
          web: {
            search: {
              provider: "brave",
            },
          },
        },
      },
      env: {},
    });

    expect(fs.existsSync(installDir)).toBe(true);
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
    expect(result).toEqual({
      changes: [],
      warnings: [
        `Failed to install missing configured plugin "brave" from ${expectedNpmInstallSpec("@daisyclaw/brave-plugin")}: network unavailable`,
      ],
      failedPluginIds: ["brave"],
      records,
    });
  });

  it("does not replace a non-official install that collides with an official plugin id", async () => {
    const extensionsDir = path.join(makeTempDir(), "extensions");
    const installDir = path.join(extensionsDir, "brave");
    mocks.resolveDefaultPluginExtensionsDir.mockReturnValue(extensionsDir);
    fs.mkdirSync(installDir, { recursive: true });
    fs.writeFileSync(path.join(installDir, "package.json"), JSON.stringify({ name: "brave" }));
    const records = {
      brave: {
        source: "path",
        sourcePath: installDir,
        installPath: installDir,
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [],
      diagnostics: [
        {
          level: "error",
          pluginId: "brave",
          message:
            "installed plugin package requires compiled runtime output for TypeScript entry index.ts: expected ./dist/index.js.",
        },
      ],
    });
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "brave",
        label: "Brave",
        install: {
          npmSpec: "@daisyclaw/brave-plugin",
          defaultChoice: "npm",
        },
        daisyclaw: {
          plugin: { id: "brave", label: "Brave" },
          webSearchProviders: [
            {
              id: "brave",
              label: "Brave Search",
              hint: "Brave Search",
              envVars: ["BRAVE_API_KEY"],
              placeholder: "BSA...",
              signupUrl: "https://example.test/brave",
            },
          ],
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        tools: {
          web: {
            search: {
              provider: "brave",
            },
          },
        },
      },
      env: {},
    });

    expect(fs.existsSync(installDir)).toBe(true);
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.updateNpmInstalledPlugins).not.toHaveBeenCalled();
    expect(result).toEqual({
      changes: [],
      warnings: [],
      records,
    });
  });

  it("installs a configured external web search plugin from provider-only config", async () => {
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "brave",
        label: "Brave",
        install: {
          npmSpec: "@daisyclaw/brave-plugin",
          defaultChoice: "npm",
        },
        daisyclaw: {
          plugin: { id: "brave", label: "Brave" },
          webSearchProviders: [
            {
              id: "brave",
              label: "Brave Search",
              hint: "Brave Search",
              envVars: ["BRAVE_API_KEY"],
              placeholder: "BSA...",
              signupUrl: "https://example.test/brave",
              credentialPath: "plugins.entries.brave.config.webSearch.apiKey",
            },
          ],
          install: {
            npmSpec: "@daisyclaw/brave-plugin",
            defaultChoice: "npm",
          },
        },
      },
    ]);
    mocks.resolveOfficialExternalPluginId.mockImplementation(
      (entry: { id?: string; daisyclaw?: { plugin?: { id?: string } } }) =>
        entry.daisyclaw?.plugin?.id ?? entry.id,
    );
    mocks.resolveOfficialExternalPluginInstall.mockImplementation(
      (entry: { install?: unknown; daisyclaw?: { install?: unknown } }) =>
        entry.daisyclaw?.install ?? entry.install ?? null,
    );
    mocks.resolveOfficialExternalPluginLabel.mockImplementation(
      (entry: { label?: string; daisyclaw?: { plugin?: { label?: string } } }) =>
        entry.daisyclaw?.plugin?.label ?? entry.label ?? "plugin",
    );
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "brave",
      targetDir: "/tmp/daisyclaw-plugins/brave",
      version: "2026.5.2",
      npmResolution: {
        name: "@daisyclaw/brave-plugin",
        version: "2026.5.2",
        resolvedSpec: "@daisyclaw/brave-plugin@2026.5.2",
      },
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        tools: {
          web: {
            search: {
              provider: "brave",
            },
          },
        },
      },
      env: {},
    });

    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@daisyclaw/brave-plugin"),
      expectedPluginId: "brave",
      trustedSourceLinkedOfficialInstall: true,
    });
    expect(result.changes).toEqual([
      `Installed missing configured plugin "brave" from ${expectedNpmInstallSpec("@daisyclaw/brave-plugin")}.`,
    ]);
  });

  it("installs configured external web search plugins from beta on the beta channel", async () => {
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "brave",
        label: "Brave",
        install: {
          npmSpec: "@daisyclaw/brave-plugin",
          defaultChoice: "npm",
        },
        daisyclaw: {
          plugin: { id: "brave", label: "Brave" },
          webSearchProviders: [
            {
              id: "brave",
              label: "Brave Search",
              hint: "Brave Search",
              envVars: ["BRAVE_API_KEY"],
              placeholder: "BSA...",
              signupUrl: "https://example.test/brave",
              credentialPath: "plugins.entries.brave.config.webSearch.apiKey",
            },
          ],
          install: {
            npmSpec: "@daisyclaw/brave-plugin",
            defaultChoice: "npm",
          },
        },
      },
    ]);
    mocks.resolveOfficialExternalPluginId.mockImplementation(
      (entry: { id?: string; daisyclaw?: { plugin?: { id?: string } } }) =>
        entry.daisyclaw?.plugin?.id ?? entry.id,
    );
    mocks.resolveOfficialExternalPluginInstall.mockImplementation(
      (entry: { install?: unknown; daisyclaw?: { install?: unknown } }) =>
        entry.daisyclaw?.install ?? entry.install ?? null,
    );
    mocks.resolveOfficialExternalPluginLabel.mockImplementation(
      (entry: { label?: string; daisyclaw?: { plugin?: { label?: string } } }) =>
        entry.daisyclaw?.plugin?.label ?? entry.label ?? "plugin",
    );
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "brave",
      targetDir: "/tmp/daisyclaw-plugins/brave",
      version: "2026.5.4-beta.1",
      npmResolution: {
        name: "@daisyclaw/brave-plugin",
        version: "2026.5.4-beta.1",
        resolvedSpec: "@daisyclaw/brave-plugin@2026.5.4-beta.1",
      },
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        update: { channel: "beta" },
        tools: {
          web: {
            search: {
              provider: "brave",
            },
          },
        },
      },
      env: {},
    });

    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: "@daisyclaw/brave-plugin@beta",
      expectedPluginId: "brave",
      trustedSourceLinkedOfficialInstall: true,
    });
    const persistedRecords = mockCallArg(
      mocks.writePersistedInstalledPluginIndexInstallRecords,
    ) as Record<string, unknown>;
    expectRecordFields(persistedRecords.brave, {
      spec: "@daisyclaw/brave-plugin@2026.5.4-beta.1",
    });
    expect(mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords, 0, 1)).toEqual({
      env: {},
    });
    expect(result.changes).toEqual([
      'Installed missing configured plugin "brave" from @daisyclaw/brave-plugin@beta.',
    ]);
  });

  it("repairs a configured plugin from a legacy npm declaration stub", async () => {
    const root = makeTempDir();
    const pluginDir = path.join(root, "extensions", "guardrail-bridge");
    writeLegacyNpmDeclarationStub({
      pluginDir,
      pluginId: "guardrail-bridge",
      npmSpec: "@guardrail-bridge/guardrail-bridge@1.0.0",
    });
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "guardrail-bridge",
      targetDir: "/tmp/daisyclaw-plugins/guardrail-bridge",
      version: "1.0.0",
      npmResolution: {
        name: "@guardrail-bridge/guardrail-bridge",
        version: "1.0.0",
        resolvedSpec: "@guardrail-bridge/guardrail-bridge@1.0.0",
        integrity: "sha512-guardrail",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          load: {
            paths: [pluginDir],
          },
          entries: {
            "guardrail-bridge": { enabled: true },
          },
        },
      },
      env: {},
    });

    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: "@guardrail-bridge/guardrail-bridge@1.0.0",
      expectedPluginId: "guardrail-bridge",
      extensionsDir: "/tmp/daisyclaw-plugins",
    });
    expect(mockCallArg(mocks.installPluginFromNpmSpec).trustedSourceLinkedOfficialInstall).toBe(
      undefined,
    );
    const records = mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords);
    expectRecordFields((records as Record<string, unknown>)["guardrail-bridge"], {
      source: "npm",
      spec: "@guardrail-bridge/guardrail-bridge@1.0.0",
      installPath: "/tmp/daisyclaw-plugins/guardrail-bridge",
      version: "1.0.0",
      resolvedName: "@guardrail-bridge/guardrail-bridge",
    });
    expect(result.changes).toEqual([
      'Installed missing configured plugin "guardrail-bridge" from @guardrail-bridge/guardrail-bridge@1.0.0.',
    ]);
    expect(result.warnings).toStrictEqual([]);
  });

  it("does not install a configured external web search plugin when search is disabled", async () => {
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "brave",
        label: "Brave",
        install: {
          npmSpec: "@daisyclaw/brave-plugin",
          defaultChoice: "npm",
        },
        daisyclaw: {
          plugin: { id: "brave", label: "Brave" },
          webSearchProviders: [
            {
              id: "brave",
              label: "Brave Search",
              hint: "Brave Search",
              envVars: ["BRAVE_API_KEY"],
              placeholder: "BSA...",
              signupUrl: "https://example.test/brave",
              credentialPath: "plugins.entries.brave.config.webSearch.apiKey",
            },
          ],
          install: {
            npmSpec: "@daisyclaw/brave-plugin",
            defaultChoice: "npm",
          },
        },
      },
    ]);
    mocks.resolveOfficialExternalPluginId.mockImplementation(
      (entry: { id?: string; daisyclaw?: { plugin?: { id?: string } } }) =>
        entry.daisyclaw?.plugin?.id ?? entry.id,
    );
    mocks.resolveOfficialExternalPluginInstall.mockImplementation(
      (entry: { install?: unknown; daisyclaw?: { install?: unknown } }) =>
        entry.daisyclaw?.install ?? entry.install ?? null,
    );
    mocks.resolveOfficialExternalPluginLabel.mockImplementation(
      (entry: { label?: string; daisyclaw?: { plugin?: { label?: string } } }) =>
        entry.daisyclaw?.plugin?.label ?? entry.label ?? "plugin",
    );

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        tools: {
          web: {
            search: {
              enabled: false,
              provider: "brave",
            },
          },
        },
      },
      env: {},
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
    expect(result).toEqual({ changes: [], warnings: [], records: {} });
  });
});
