import { describe, expect, it } from "vitest";
import { GATEWAY_AUX_METHODS } from "../server-aux-methods.js";
import { coreGatewayHandlers } from "../server-methods.js";
import { CORE_GATEWAY_METHOD_SPECS } from "./core-descriptors.js";

/** Declared for its scope only: an HTTP route reuses it, no socket method. */
const SCOPE_ONLY_METHODS = new Set(["assistant.media.get"]);

describe("core gateway methods", () => {
  // sessions.forkFromMessage had a declared scope and a handler, but no entry
  // in the lazy handler list, so every call answered "unknown method" and
  // Regenerate and edit-and-resend failed for weeks without a test noticing.
  it("gives every declared method code that answers it", () => {
    const answeredElsewhere = new Set<string>([...GATEWAY_AUX_METHODS, ...SCOPE_ONLY_METHODS]);
    const unanswered = CORE_GATEWAY_METHOD_SPECS.map((spec) => spec.name).filter(
      (name) => !coreGatewayHandlers[name] && !answeredElsewhere.has(name),
    );

    expect(unanswered).toEqual([]);
  });

  it("answers the method Regenerate uses", () => {
    expect(coreGatewayHandlers["sessions.forkFromMessage"]).toBeTypeOf("function");
  });
});
