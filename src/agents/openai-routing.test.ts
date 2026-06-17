// Verifies OpenAI model selections route between DaisyClaw and Codex runtimes.
import { describe, expect, it } from "vitest";
import type { DaisyClawConfig } from "../config/types.daisyclaw.js";
import {
  listOpenAIAuthProfileProvidersForAgentRuntime,
  modelSelectionShouldEnsureCodexPlugin,
  openAIProviderUsesCodexRuntimeByDefault,
  resolveContextConfigProviderForRuntime,
  resolveOpenAIRuntimeProvider,
  resolveSelectedOpenAIRuntimeProvider,
} from "./openai-routing.js";

describe("OpenAI runtime routing policy", () => {
  it("uses Codex by default for official OpenAI agent model selections", () => {
    expect(openAIProviderUsesCodexRuntimeByDefault({ provider: "openai" })).toBe(true);
    expect(
      modelSelectionShouldEnsureCodexPlugin({
        model: "openai/gpt-5.5",
        config: {} as DaisyClawConfig,
      }),
    ).toBe(true);
  });

  it("does not force Codex for custom OpenAI-compatible base URLs", () => {
    // A custom baseUrl means the provider key is only OpenAI-compatible, not official OpenAI.
    const config = {
      models: {
        providers: {
          openai: {
            baseUrl: "https://example.test/v1",
            models: [],
          },
        },
      },
    } satisfies DaisyClawConfig;

    expect(openAIProviderUsesCodexRuntimeByDefault({ provider: "openai", config })).toBe(false);
    expect(modelSelectionShouldEnsureCodexPlugin({ model: "openai/gpt-5.5", config })).toBe(false);
    expect(
      resolveContextConfigProviderForRuntime({
        provider: "openai",
        runtimeId: "codex",
        config,
      }),
    ).toBe("openai");
  });

  it("normalizes OpenAI provider keys before checking custom base URLs", () => {
    const config = {
      models: {
        providers: {
          OpenAI: {
            baseUrl: "https://example.test/v1",
            models: [],
          },
        },
      },
    } satisfies DaisyClawConfig;

    expect(openAIProviderUsesCodexRuntimeByDefault({ provider: "openai", config })).toBe(false);
    expect(modelSelectionShouldEnsureCodexPlugin({ model: "openai/gpt-5.5", config })).toBe(false);
  });

  it("uses canonical OpenAI context config under the Codex runtime", () => {
    expect(
      resolveContextConfigProviderForRuntime({
        provider: "openai",
        runtimeId: "codex",
      }),
    ).toBe("openai");
  });

  it("uses legacy Codex context config when canonical OpenAI config is absent", () => {
    const config = {
      models: {
        providers: {
          openai: {
            baseUrl: "https://chatgpt.com/backend-api/codex",
            models: [],
          },
        },
      },
    } satisfies DaisyClawConfig;

    expect(
      resolveContextConfigProviderForRuntime({
        provider: "openai",
        runtimeId: "codex",
        config,
      }),
    ).toBe("openai");
  });

  it("keeps explicit DaisyClaw plus Codex auth profile under the unified OpenAI provider", () => {
    // OpenAI auth now stays canonical even when the runtime is not Codex.
    expect(
      listOpenAIAuthProfileProvidersForAgentRuntime({
        provider: "openai",
        harnessRuntime: "daisyclaw",
      }),
    ).toEqual(["openai"]);
    expect(
      resolveOpenAIRuntimeProvider({
        provider: "openai",
        harnessRuntime: "daisyclaw",
        authProfileProvider: "openai",
        authProfileId: "openai:work",
      }),
    ).toBe("openai");
  });

  it("keeps legacy Codex auth order under the canonical OpenAI provider", () => {
    const config = {
      auth: {
        order: {
          openai: ["openai:work", "openai:backup"],
        },
      },
    } satisfies DaisyClawConfig;

    expect(
      listOpenAIAuthProfileProvidersForAgentRuntime({
        provider: "openai",
        harnessRuntime: "daisyclaw",
        config,
      }),
    ).toEqual(["openai"]);
    expect(
      resolveSelectedOpenAIRuntimeProvider({
        provider: "openai",
        harnessRuntime: "daisyclaw",
        config,
      }),
    ).toBe("openai");
    expect(
      resolveOpenAIRuntimeProvider({
        provider: "openai",
        harnessRuntime: "daisyclaw",
        config,
      }),
    ).toBe("openai");
  });

  it("checks legacy Codex auth before canonical OpenAI for pre-doctor state", () => {
    const config = {
      auth: {
        order: {
          openai: ["openai:work", "openai:backup"],
        },
      },
    } satisfies DaisyClawConfig;

    expect(
      listOpenAIAuthProfileProvidersForAgentRuntime({
        provider: "openai",
        harnessRuntime: "daisyclaw",
        config,
      }),
    ).toEqual(["openai"]);
  });

  it("keeps explicit OpenAI DaisyClaw API-key auth order ahead of Codex backups", () => {
    const config = {
      auth: {
        order: {
          openai: ["openai:backup", "openai:work"],
        },
      },
    } satisfies DaisyClawConfig;

    expect(
      listOpenAIAuthProfileProvidersForAgentRuntime({
        provider: "openai",
        harnessRuntime: "daisyclaw",
        config,
      }),
    ).toEqual(["openai"]);
    expect(
      resolveSelectedOpenAIRuntimeProvider({
        provider: "openai",
        harnessRuntime: "daisyclaw",
        config,
      }),
    ).toBe("openai");
  });

  it("does not route custom OpenAI-compatible DaisyClaw configs through Codex auth order", () => {
    const config = {
      models: {
        providers: {
          openai: {
            baseUrl: "https://proxy.example.test/v1",
            models: [],
          },
        },
      },
      auth: {
        order: {
          openai: ["openai:work", "openai:backup"],
        },
      },
    } satisfies DaisyClawConfig;

    expect(
      listOpenAIAuthProfileProvidersForAgentRuntime({
        provider: "openai",
        harnessRuntime: "daisyclaw",
        config,
      }),
    ).toEqual(["openai"]);
    expect(
      resolveSelectedOpenAIRuntimeProvider({
        provider: "openai",
        harnessRuntime: "daisyclaw",
        config,
      }),
    ).toBe("openai");
  });

  it("validates Codex harness auth through the unified OpenAI provider contract", () => {
    expect(
      listOpenAIAuthProfileProvidersForAgentRuntime({
        provider: "openai",
        harnessRuntime: "codex",
      }),
    ).toEqual(["openai"]);
  });

  it("keeps OpenAI as the runtime provider when harness runtime is codex", () => {
    expect(
      resolveSelectedOpenAIRuntimeProvider({
        provider: "openai",
        harnessRuntime: "codex",
      }),
    ).toBe("openai");
  });

  it("does not route non-OpenAI providers when runtime is codex", () => {
    expect(
      resolveSelectedOpenAIRuntimeProvider({
        provider: "anthropic",
        harnessRuntime: "codex",
      }),
    ).toBe("anthropic");
  });
});
