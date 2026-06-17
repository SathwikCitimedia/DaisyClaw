// Error output tests cover program-level error display and exit messaging.
import { describe, expect, it } from "vitest";
import { formatCliParseErrorOutput } from "./error-output.js";

describe("formatCliParseErrorOutput", () => {
  it("explains unknown commands with root help and plugin hints", () => {
    const output = formatCliParseErrorOutput("error: unknown command 'wat'\n", {
      argv: ["node", "daisyclaw", "wat"],
    });

    expect(output).toBe(
      'DaisyClaw does not know the command "wat".\nTry: daisyclaw --help\nPlugin command? daisyclaw plugins list\nDocs: https://docs.daisyclaw.ai/cli\n',
    );
  });

  it("points unknown options at the active command help", () => {
    const output = formatCliParseErrorOutput("error: unknown option '--wat'\n", {
      argv: ["node", "daisyclaw", "channels", "status", "--wat"],
    });

    expect(output).toBe(
      'DaisyClaw does not recognize option "--wat".\nTry: daisyclaw channels status --help\n',
    );
  });

  it("points missing required arguments at command help", () => {
    const output = formatCliParseErrorOutput("error: missing required argument 'name'\n", {
      argv: ["node", "daisyclaw", "plugins", "install"],
    });

    expect(output).toBe(
      'Missing required argument "name".\nTry: daisyclaw plugins install --help\n',
    );
  });
});
