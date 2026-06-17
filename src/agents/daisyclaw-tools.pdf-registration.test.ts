// Verifies PDF tool factory output is included in DaisyClaw tool registration.
import { describe, expect, it } from "vitest";
import { collectPresentDaisyClawTools } from "./daisyclaw-tools.registration.js";
import { createPdfTool } from "./tools/pdf-tool.js";

describe("createDaisyClawTools PDF registration", () => {
  it("includes the pdf tool when the pdf factory returns a tool", () => {
    const pdfTool = createPdfTool({
      agentDir: "/tmp/daisyclaw-agent-main",
      config: {
        agents: {
          defaults: {
            pdfModel: { primary: "openai/gpt-5.4-mini" },
          },
        },
      },
    });

    expect(pdfTool?.name).toBe("pdf");
    expect(collectPresentDaisyClawTools([pdfTool]).map((tool) => tool.name)).toEqual(["pdf"]);
  });
});
