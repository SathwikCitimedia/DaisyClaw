import { describe, expect, it } from "vitest";
import type { ModelCatalogEntry } from "../types.ts";
import { listProviderModelCandidates, pickProviderTestModel } from "./model-pick.ts";

function entry(provider: string, id: string, name?: string): ModelCatalogEntry {
  return { provider, id, name: name ?? id } as ModelCatalogEntry;
}

describe("listProviderModelCandidates", () => {
  it("keeps a slash inside a model id, because it is part of the provider's name for it", () => {
    // Groq really calls these models `groq/compound` and
    // `meta-llama/llama-4-scout-17b-16e-instruct`; OpenRouter's are
    // `moonshotai/kimi-k2.6`. Cutting the first segment off sent the provider
    // a name it had never heard of, and every Groq model failed on Sept 16.
    const picked = listProviderModelCandidates(
      [
        entry("groq", "groq/compound", "Compound"),
        entry("groq", "meta-llama/llama-4-scout-17b-16e-instruct"),
        entry("groq", "openai/gpt-oss-120b"),
        entry("openrouter", "moonshotai/kimi-k2.6", "Kimi K2.6"),
      ],
      "groq",
    );

    expect(picked.map((p) => p.modelId)).toEqual([
      "groq/compound",
      "meta-llama/llama-4-scout-17b-16e-instruct",
      "openai/gpt-oss-120b",
    ]);
    expect(picked.map((p) => p.ref)).toEqual([
      "groq/groq/compound",
      "groq/meta-llama/llama-4-scout-17b-16e-instruct",
      "groq/openai/gpt-oss-120b",
    ]);
    expect(picked[0]?.name).toBe("Compound");
  });

  it("builds the reference from the entry's provider, never from the id", () => {
    const [openai] = listProviderModelCandidates([entry("openai", "gpt-5.4", "GPT-5.4")], "openai");
    expect(openai).toEqual({ ref: "openai/gpt-5.4", modelId: "gpt-5.4", name: "GPT-5.4" });
  });

  it("filters by provider case-insensitively and offers the first as the test model", () => {
    const catalog = [entry("Anthropic", "claude-fable-5"), entry("openai", "gpt-5.4")];
    expect(listProviderModelCandidates(catalog, "anthropic")).toHaveLength(1);
    expect(pickProviderTestModel(catalog, "anthropic")?.ref).toBe("Anthropic/claude-fable-5");
    expect(pickProviderTestModel(catalog, "groq")).toBeNull();
  });
});
