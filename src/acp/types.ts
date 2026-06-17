/** ACP server option re-exports and DaisyClaw agent identity metadata. */
export type { AcpProvenanceMode, AcpServerOptions, AcpSession } from "@daisyclaw/acp-core/types";
export { normalizeAcpProvenanceMode } from "@daisyclaw/acp-core/types";
import { VERSION } from "../version.js";

/** ACP agent identity advertised during protocol initialization. */
export const ACP_AGENT_INFO = {
  name: "daisyclaw-acp",
  title: "DaisyClaw ACP Gateway",
  version: VERSION,
};
