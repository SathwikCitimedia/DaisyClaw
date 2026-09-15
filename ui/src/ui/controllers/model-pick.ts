// Chooses which model to put in front of the user for a provider they just
// connected. Kept free of rendering imports on purpose: the first-run wizard,
// the model settings and the consumer smoke suite all call this one function,
// so the model the product picks and the model under test can never drift.
import type { ModelCatalogEntry } from "../types.ts";

export type PickedProviderModel = {
  /** Fully qualified reference, e.g. `openai/gpt-5.4`. */
  ref: string;
  /** Bare model id as the provider knows it, e.g. `gpt-5.4`. */
  modelId: string;
  /** Display name, for telling the user which model was chosen. */
  name: string;
};

function belongsToProvider(entry: ModelCatalogEntry, providerId: string): boolean {
  return (entry.provider ?? "").toLowerCase() === providerId.toLowerCase();
}

function toPicked(entry: ModelCatalogEntry): PickedProviderModel {
  const hasProviderPrefix = entry.id.includes("/");
  const modelId = hasProviderPrefix ? entry.id.split("/").slice(1).join("/") : entry.id;
  const ref = hasProviderPrefix ? entry.id : `${entry.provider}/${entry.id}`;
  return { ref, modelId, name: entry.name || modelId };
}

/**
 * The provider's models, best first, as candidates to try. Callers walk this
 * list so a model the account cannot use falls through to the next one instead
 * of ending the setup.
 */
export function listProviderModelCandidates(
  catalog: readonly ModelCatalogEntry[],
  providerId: string,
): PickedProviderModel[] {
  return catalog.filter((entry) => belongsToProvider(entry, providerId)).map(toPicked);
}

/** The single model the product offers first for a provider. */
export function pickProviderTestModel(
  catalog: readonly ModelCatalogEntry[],
  providerId: string,
): PickedProviderModel | null {
  return listProviderModelCandidates(catalog, providerId)[0] ?? null;
}
