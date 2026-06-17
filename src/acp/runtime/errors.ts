/** ACP runtime error exports wired to DaisyClaw secret redaction. */
import { configureAcpErrorRedactor } from "@daisyclaw/acp-core";
import { redactSensitiveText } from "../../logging/redact.js";

// Ensure ACP-core runtime errors use DaisyClaw's secret redaction before re-export.
configureAcpErrorRedactor(redactSensitiveText);

export * from "@daisyclaw/acp-core/runtime/errors";
