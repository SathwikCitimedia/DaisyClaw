import { describe, expect, it } from "vitest";
import { parseSearchTerms, textMatchesSearchQuery } from "./search-match.ts";

describe("chat find matching", () => {
  it("matches every word in any order", () => {
    expect(textMatchesSearchQuery("Renewal of the passport", "passport renewal")).toBe(true);
    expect(textMatchesSearchQuery("Passport only", "passport renewal")).toBe(false);
  });

  it("keeps a quoted phrase together", () => {
    expect(parseSearchTerms('"two photos" Passport')).toEqual(["two photos", "passport"]);
    expect(textMatchesSearchQuery("two passport photos", '"two photos"')).toBe(false);
    expect(textMatchesSearchQuery("Bring two   photos", '"two photos"')).toBe(true);
  });

  it("ignores case and accents", () => {
    expect(textMatchesSearchQuery("Meet at the Café", "cafe")).toBe(true);
    expect(textMatchesSearchQuery("meet at the cafe", "CAFÉ")).toBe(true);
  });

  it("treats an empty query as matching everything", () => {
    expect(textMatchesSearchQuery("anything", "   ")).toBe(true);
    expect(textMatchesSearchQuery(null, "x")).toBe(false);
  });
});
