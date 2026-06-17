// Memory Core plugin module implements public artifacts behavior.
import {
  listMemoryHostPublicArtifacts,
  type MemoryPluginPublicArtifact,
} from "daisyclaw/plugin-sdk/memory-host-core";
import type { DaisyClawConfig } from "../api.js";

export async function listMemoryCorePublicArtifacts(params: {
  cfg: DaisyClawConfig;
}): Promise<MemoryPluginPublicArtifact[]> {
  return await listMemoryHostPublicArtifacts(params);
}
