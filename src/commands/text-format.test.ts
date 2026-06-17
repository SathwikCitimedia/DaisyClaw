// Text format tests cover command-facing shortening helpers.
import { describe, expect, it } from "vitest";
import { shortenText } from "./text-format.js";

describe("shortenText", () => {
  it("returns original text when it fits", () => {
    expect(shortenText("daisyclaw", 16)).toBe("daisyclaw");
  });

  it("truncates and appends ellipsis when over limit", () => {
    expect(shortenText("daisyclaw-status-output", 10)).toBe("daisyclaw-…");
  });

  it("counts multi-byte characters correctly", () => {
    expect(shortenText("hello🙂world", 7)).toBe("hello🙂…");
  });
});
