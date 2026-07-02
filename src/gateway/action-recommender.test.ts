import { describe, expect, it } from "vitest";
import { MAX_RECOMMENDED_ACTIONS, parseRecommendedActionIds } from "./action-recommender.js";

describe("parseRecommendedActionIds", () => {
  it("parses a clean JSON array of known ids in order", () => {
    expect(parseRecommendedActionIds('["summarize","draft_email"]')).toEqual([
      "summarize",
      "draft_email",
    ]);
  });

  it("strips markdown code fences around the JSON", () => {
    expect(parseRecommendedActionIds('```json\n["research"]\n```')).toEqual(["research"]);
  });

  it("drops unknown/hallucinated ids and dedupes", () => {
    expect(
      parseRecommendedActionIds('["summarize","make_pizza","summarize","break_steps"]'),
    ).toEqual(["summarize", "break_steps"]);
  });

  it(`caps the result at ${MAX_RECOMMENDED_ACTIONS}`, () => {
    const result = parseRecommendedActionIds(
      '["summarize","short_version","research","break_steps","draft_email"]',
    );
    expect(result).toHaveLength(MAX_RECOMMENDED_ACTIONS);
  });

  it("recovers ids from non-JSON prose in order of appearance", () => {
    expect(parseRecommendedActionIds("Maybe draft_email, or first summarize it.")).toEqual([
      "draft_email",
      "summarize",
    ]);
  });

  it("returns empty for empty array, blank, or nullish input", () => {
    expect(parseRecommendedActionIds("[]")).toEqual([]);
    expect(parseRecommendedActionIds("   ")).toEqual([]);
    expect(parseRecommendedActionIds(null)).toEqual([]);
    expect(parseRecommendedActionIds(undefined)).toEqual([]);
  });
});
