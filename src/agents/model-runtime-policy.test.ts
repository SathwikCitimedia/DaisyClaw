// Covers model runtime policy precedence and private QA runtime overrides.
import { afterEach, describe, expect, it } from "vitest";
import type { ModelDefinitionConfig } from "../config/types.models.js";
import type { DaisyClawConfig } from "../config/types.daisyclaw.js";
import { resolveModelRuntimePolicy } from "./model-runtime-policy.js";

const ORIGINAL_BUILD_PRIVATE_QA = process.env.DAISYCLAW_BUILD_PRIVATE_QA;
const ORIGINAL_QA_FORCE_RUNTIME = process.env.DAISYCLAW_QA_FORCE_RUNTIME;

const createModelConfig = (agentRuntimeId: string): ModelDefinitionConfig => ({
  id: "qwen-local",
  name: "Qwen Local",
  reasoning: false,
  input: ["text"],
  cost: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
  },
  contextWindow: 32_768,
  maxTokens: 4096,
  agentRuntime: { id: agentRuntimeId },
});

function restoreEnv(
  name: "DAISYCLAW_BUILD_PRIVATE_QA" | "DAISYCLAW_QA_FORCE_RUNTIME",
  value: string | undefined,
): void {
  // Tests mutate private QA env gates; restore exact process state after each.
  if (value == null) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

function makeProviderRuntimeConfig(runtime: string): DaisyClawConfig {
  return {
    models: {
      providers: {
        openai: {
          baseUrl: "https://api.openai.example/v1",
          agentRuntime: { id: runtime },
          models: [],
        },
      },
    },
  } as DaisyClawConfig;
}

afterEach(() => {
  restoreEnv("DAISYCLAW_BUILD_PRIVATE_QA", ORIGINAL_BUILD_PRIVATE_QA);
  restoreEnv("DAISYCLAW_QA_FORCE_RUNTIME", ORIGINAL_QA_FORCE_RUNTIME);
});

describe("resolveModelRuntimePolicy", () => {
  it("ignores the QA force-runtime override when the private QA gate is unset", () => {
    delete process.env.DAISYCLAW_BUILD_PRIVATE_QA;
    process.env.DAISYCLAW_QA_FORCE_RUNTIME = "daisyclaw";

    expect(
      resolveModelRuntimePolicy({
        config: makeProviderRuntimeConfig("codex"),
        provider: "openai",
        modelId: "gpt-5.5",
      }),
    ).toEqual({
      policy: { id: "codex" },
      source: "provider",
    });
  });

  it("respects the QA force-runtime override when the private QA gate is set", () => {
    // The force-runtime override is intentionally gated to private QA builds so
    // normal users cannot accidentally change model runtime selection via env.
    process.env.DAISYCLAW_BUILD_PRIVATE_QA = "1";
    process.env.DAISYCLAW_QA_FORCE_RUNTIME = "daisyclaw";

    expect(
      resolveModelRuntimePolicy({
        config: makeProviderRuntimeConfig("codex"),
        provider: "openai",
        modelId: "gpt-5.5",
      }),
    ).toEqual({
      policy: { id: "daisyclaw" },
      source: "model",
    });
  });

  it("ignores invalid QA force-runtime values even when the private QA gate is set", () => {
    process.env.DAISYCLAW_BUILD_PRIVATE_QA = "1";
    process.env.DAISYCLAW_QA_FORCE_RUNTIME = "bogus";

    expect(
      resolveModelRuntimePolicy({
        config: makeProviderRuntimeConfig("codex"),
        provider: "openai",
        modelId: "gpt-5.5",
      }),
    ).toEqual({
      policy: { id: "codex" },
      source: "provider",
    });
  });

  it("honors provider wildcard agent model runtime policy entries", () => {
    const config = {
      agents: {
        defaults: {
          models: {
            "vllm/*": { agentRuntime: { id: "daisyclaw" } },
          },
        },
      },
    } as DaisyClawConfig;

    expect(
      resolveModelRuntimePolicy({
        config,
        provider: "vllm",
        modelId: "qwen-local",
      }),
    ).toEqual({
      policy: { id: "daisyclaw" },
      source: "model",
      matchedProvider: "vllm",
    });
  });

  it("honors provider wildcard agent model runtime policy entries without a concrete model id", () => {
    const config = {
      agents: {
        defaults: {
          models: {
            "vllm/*": { agentRuntime: { id: "daisyclaw" } },
          },
        },
      },
    } as DaisyClawConfig;

    expect(
      resolveModelRuntimePolicy({
        config,
        provider: "vllm",
      }),
    ).toEqual({
      policy: { id: "daisyclaw" },
      source: "model",
      matchedProvider: "vllm",
    });
  });

  it("prefers exact agent model runtime policy entries over provider wildcards", () => {
    // Exact configured model refs beat provider wildcards to keep intentional
    // per-model runtime routing stable.
    const config = {
      agents: {
        defaults: {
          models: {
            "vllm/*": { agentRuntime: { id: "daisyclaw" } },
            "vllm/qwen-local": { agentRuntime: { id: "codex" } },
          },
        },
      },
    } as DaisyClawConfig;

    expect(
      resolveModelRuntimePolicy({
        config,
        provider: "vllm",
        modelId: "qwen-local",
      }),
    ).toEqual({
      policy: { id: "codex" },
      source: "model",
      matchedProvider: "vllm",
    });
  });

  it("prefers exact provider model runtime policy over agent provider wildcards", () => {
    const config = {
      agents: {
        defaults: {
          models: {
            "vllm/*": { agentRuntime: { id: "daisyclaw" } },
          },
        },
      },
      models: {
        providers: {
          vllm: {
            baseUrl: "http://127.0.0.1:11434/v1",
            models: [createModelConfig("codex")],
          },
        },
      },
    } as DaisyClawConfig;

    expect(
      resolveModelRuntimePolicy({
        config,
        provider: "vllm",
        modelId: "qwen-local",
      }),
    ).toEqual({
      policy: { id: "codex" },
      source: "model",
    });
  });

  it("prefers agent provider wildcard runtime policy over provider runtime policy", () => {
    const config = {
      agents: {
        defaults: {
          models: {
            "vllm/*": { agentRuntime: { id: "daisyclaw" } },
          },
        },
      },
      models: {
        providers: {
          vllm: {
            baseUrl: "http://127.0.0.1:11434/v1",
            agentRuntime: { id: "codex" },
            models: [],
          },
        },
      },
    } as DaisyClawConfig;

    expect(
      resolveModelRuntimePolicy({
        config,
        provider: "vllm",
        modelId: "qwen-local",
      }),
    ).toEqual({
      policy: { id: "daisyclaw" },
      source: "model",
      matchedProvider: "vllm",
    });
  });

  it("matches a provider-prefixed agent model entry when the caller provider is empty", () => {
    const config = {
      agents: {
        defaults: {
          models: {
            "anthropic/claude-opus-4-7[1m]": { agentRuntime: { id: "claude-cli" } },
          },
        },
      },
    } as DaisyClawConfig;

    expect(
      resolveModelRuntimePolicy({
        config,
        provider: "",
        modelId: "claude-opus-4-7[1m]",
      }),
    ).toEqual({
      policy: { id: "claude-cli" },
      source: "model",
      matchedProvider: "anthropic",
    });
  });

  it("still rejects provider-prefixed entries whose provider disagrees with a non-empty caller provider", () => {
    const config = {
      agents: {
        defaults: {
          models: {
            "openrouter/claude-opus-4-7[1m]": { agentRuntime: { id: "openrouter-stream" } },
          },
        },
      },
    } as DaisyClawConfig;

    expect(
      resolveModelRuntimePolicy({
        config,
        provider: "anthropic",
        modelId: "claude-opus-4-7[1m]",
      }),
    ).toEqual({});
  });

  it("matches a provider wildcard agent model entry when the caller provider is empty", () => {
    const config = {
      agents: {
        defaults: {
          models: {
            "anthropic/*": { agentRuntime: { id: "claude-cli" } },
          },
        },
      },
    } as DaisyClawConfig;

    expect(
      resolveModelRuntimePolicy({
        config,
        provider: "",
        modelId: "claude-opus-4-7[1m]",
      }),
    ).toEqual({
      policy: { id: "claude-cli" },
      source: "model",
      matchedProvider: "anthropic",
    });
  });

  it("prefers an agent-specific model entry over a conflicting defaults entry when the caller provider is empty", () => {
    const config = {
      agents: {
        defaults: {
          models: {
            "openai/foo-1": { agentRuntime: { id: "codex" } },
          },
        },
        list: [
          {
            id: "main",
            models: {
              "anthropic/foo-1": { agentRuntime: { id: "claude-cli" } },
            },
          },
        ],
      },
    } as DaisyClawConfig;

    expect(
      resolveModelRuntimePolicy({
        config,
        provider: "",
        modelId: "foo-1",
        agentId: "main",
      }),
    ).toEqual({
      policy: { id: "claude-cli" },
      source: "model",
      matchedProvider: "anthropic",
    });
  });

  it("fails closed for duplicate provider-prefixed bare-model policies", () => {
    const config = {
      agents: {
        defaults: {
          models: {
            "openai/foo-1": { agentRuntime: { id: "codex" } },
            "anthropic/foo-1": { agentRuntime: { id: "claude-cli" } },
            "anthropic/*": { agentRuntime: { id: "claude-cli" } },
          },
        },
      },
    } as DaisyClawConfig;

    expect(
      resolveModelRuntimePolicy({
        config,
        provider: "",
        modelId: "foo-1",
      }),
    ).toEqual({});
  });
});
