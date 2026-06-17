/**
 * BytePlus model provider builders backed by the plugin manifest catalog.
 */
import { buildManifestModelProviderConfig } from "daisyclaw/plugin-sdk/provider-catalog-shared";
import type { ModelProviderConfig } from "daisyclaw/plugin-sdk/provider-model-shared";
import manifest from "./daisyclaw.plugin.json" with { type: "json" };

/** Builds the standard BytePlus model provider config. */
export function buildBytePlusProvider(): ModelProviderConfig {
  return buildManifestModelProviderConfig({
    providerId: "byteplus",
    catalog: manifest.modelCatalog.providers.byteplus,
  });
}

/** Builds the BytePlus Plan coding-provider config. */
export function buildBytePlusCodingProvider(): ModelProviderConfig {
  return buildManifestModelProviderConfig({
    providerId: "byteplus-plan",
    catalog: manifest.modelCatalog.providers["byteplus-plan"],
  });
}
