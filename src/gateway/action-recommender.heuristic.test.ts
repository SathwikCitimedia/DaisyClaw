import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateConversationLabel: vi.fn(async (_params: unknown): Promise<string | null> => null),
}));

vi.mock("../auto-reply/reply/conversation-label-generator.js", () => ({
  generateConversationLabel: mocks.generateConversationLabel,
}));

const { buildHeuristicActionRecommendations, generateActionRecommendations } =
  await import("./action-recommender.js");

const longReply = Array.from({ length: 130 }, (_, i) => `word${i}`).join(" ");
const cfg = {} as never;

describe("buildHeuristicActionRecommendations", () => {
  it("suggests summarize and short version for long replies", () => {
    expect(buildHeuristicActionRecommendations(longReply)).toEqual(["summarize", "short_version"]);
  });

  it("suggests breaking into steps for list-shaped or step-based replies", () => {
    const list = "Do this:\n1. open settings\n2. pick a model\n3. paste the key";
    expect(buildHeuristicActionRecommendations(list)).toContain("break_steps");
    expect(buildHeuristicActionRecommendations("Step 1 is easy, step 2 is harder.")).toContain(
      "break_steps",
    );
  });

  it("suggests drafting an email when the reply reads like one", () => {
    expect(
      buildHeuristicActionRecommendations("Dear Priya,\nthanks for the update.\nKind regards, Sam"),
    ).toContain("draft_email");
  });

  it("stays quiet for short, plain replies", () => {
    expect(buildHeuristicActionRecommendations("Sure, it's 24°C and sunny.")).toEqual([]);
    expect(buildHeuristicActionRecommendations("   ")).toEqual([]);
  });
});

describe("generateActionRecommendations", () => {
  it("answers from heuristics without touching the model by default", async () => {
    mocks.generateConversationLabel.mockClear();
    const outcome = await generateActionRecommendations({ messageText: longReply, cfg });
    expect(outcome.source).toBe("heuristic");
    expect(outcome.actions).toEqual(["summarize", "short_version"]);
    expect(mocks.generateConversationLabel).not.toHaveBeenCalled();
  });

  it("asks the model under a short timeout when refining", async () => {
    mocks.generateConversationLabel.mockClear();
    mocks.generateConversationLabel.mockResolvedValueOnce('["draft_email"]');
    const outcome = await generateActionRecommendations({
      messageText: longReply,
      cfg,
      refine: true,
    });
    expect(outcome).toEqual({ actions: ["draft_email"], source: "model" });
    const call = mocks.generateConversationLabel.mock.calls[0]?.[0] as { timeoutMs?: number };
    expect(call.timeoutMs).toBeLessThanOrEqual(4000);
  });

  it("keeps the heuristic chips when the model times out or fails", async () => {
    mocks.generateConversationLabel.mockResolvedValueOnce(null);
    const outcome = await generateActionRecommendations({
      messageText: longReply,
      cfg,
      refine: true,
    });
    expect(outcome).toEqual({ actions: ["summarize", "short_version"], source: "heuristic" });
  });
});
