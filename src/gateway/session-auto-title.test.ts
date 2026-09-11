import { describe, expect, it, vi } from "vitest";
import {
  buildHeuristicSessionTitle,
  isAutoTitleEligibleSessionKey,
  maybeAutoTitleSession,
  sanitizeGeneratedTitle,
} from "./session-auto-title.js";

describe("isAutoTitleEligibleSessionKey", () => {
  it("accepts control-UI / dashboard sessions", () => {
    expect(isAutoTitleEligibleSessionKey("main")).toBe(true);
    expect(isAutoTitleEligibleSessionKey("agent:main:main")).toBe(true);
    expect(isAutoTitleEligibleSessionKey("dashboard:53fe966a-1d95-4")).toBe(true);
    expect(isAutoTitleEligibleSessionKey("global")).toBe(true);
  });

  it("rejects channel, cron, subagent, and acp sessions", () => {
    expect(isAutoTitleEligibleSessionKey("agent:main:cron:abc")).toBe(false);
    expect(isAutoTitleEligibleSessionKey("cron:abc")).toBe(false);
    expect(isAutoTitleEligibleSessionKey("agent:main:subagent:abc")).toBe(false);
    expect(isAutoTitleEligibleSessionKey("agent:main:discord:direct:123")).toBe(false);
    expect(isAutoTitleEligibleSessionKey("agent:main:slack:group:123")).toBe(false);
    expect(isAutoTitleEligibleSessionKey("discord:123")).toBe(false);
    expect(isAutoTitleEligibleSessionKey("imessage:g-1")).toBe(false);
    expect(isAutoTitleEligibleSessionKey("agent:main:acp:foo")).toBe(false);
    expect(isAutoTitleEligibleSessionKey("")).toBe(false);
  });
});

describe("buildHeuristicSessionTitle", () => {
  it("returns a trimmed title from the first message", () => {
    expect(buildHeuristicSessionTitle("Fix the login bug")).toBe("Fix the login bug");
  });

  it("strips markdown, code, and urls", () => {
    expect(buildHeuristicSessionTitle("Check `npm run build` at https://x.io now")).toBe(
      "Check at now",
    );
  });

  it("prefers the first sentence", () => {
    expect(buildHeuristicSessionTitle("Deploy the staging server. Then tell me.")).toBe(
      "Deploy the staging server",
    );
  });

  it("caps overly long messages with an ellipsis", () => {
    const title = buildHeuristicSessionTitle(
      "Please help me design a scalable multi region database architecture for analytics",
    );
    expect(title).not.toBeNull();
    expect(title!.length).toBeLessThanOrEqual(49);
    expect(title!.endsWith("…")).toBe(true);
  });

  it("returns null for empty / whitespace input", () => {
    expect(buildHeuristicSessionTitle("   ")).toBeNull();
    expect(buildHeuristicSessionTitle("```code only```")).toBeNull();
  });

  it("strips greetings and politeness so the topic leads", () => {
    expect(buildHeuristicSessionTitle("hey can you search spotify for shape of you")).toBe(
      "Search Spotify for Shape of You",
    );
    expect(buildHeuristicSessionTitle("Hi Daisy, please help me plan my trip to Goa")).toBe(
      "Plan my trip to Goa",
    );
    expect(buildHeuristicSessionTitle("i want you to fix the login bug please")).toBe(
      "Fix the Login Bug",
    );
  });

  it("title-cases all-lowercase messages but keeps the user's own capitalization", () => {
    expect(buildHeuristicSessionTitle("write a poem about the sea")).toBe(
      "Write a Poem About the Sea",
    );
    expect(buildHeuristicSessionTitle("explain how HTTPS works to a beginner")).toBe(
      "Explain how HTTPS works to a beginner",
    );
  });

  it("never strips a message down to nothing", () => {
    expect(buildHeuristicSessionTitle("hey")).toBe("Hey");
    expect(buildHeuristicSessionTitle("please")).toBe("Please");
  });
});

describe("sanitizeGeneratedTitle", () => {
  it("strips wrapping quotes and trailing punctuation", () => {
    expect(sanitizeGeneratedTitle('"Login Redirect Loop Fix."')).toBe("Login Redirect Loop Fix");
    expect(sanitizeGeneratedTitle("“Database Migration Plan”")).toBe("Database Migration Plan");
  });

  it("returns null for empty input", () => {
    expect(sanitizeGeneratedTitle("")).toBeNull();
    expect(sanitizeGeneratedTitle(null)).toBeNull();
    expect(sanitizeGeneratedTitle('"  "')).toBeNull();
  });
});

describe("maybeAutoTitleSession", () => {
  const baseParams = () => ({
    sessionKey: "dashboard:abc",
    message: "Help me fix the login redirect loop",
    applyLabel: vi.fn(async () => true),
    generateLabel: vi.fn(async () => "Login Redirect Loop Fix"),
  });

  it("applies the heuristic title instantly, then upgrades to the model title", async () => {
    const p = baseParams();
    await maybeAutoTitleSession(p);
    // Heuristic first so the chat never shows its raw key while the model is
    // slow; the model title then replaces it.
    expect(p.applyLabel).toHaveBeenCalledTimes(2);
    expect(p.applyLabel).toHaveBeenNthCalledWith(1, "Fix the Login Redirect Loop");
    expect(p.applyLabel).toHaveBeenNthCalledWith(2, "Login Redirect Loop Fix");
  });

  it("applies the heuristic before the model call resolves", async () => {
    let resolveModel: (value: string | null) => void = () => {};
    const p = {
      ...baseParams(),
      generateLabel: vi.fn(() => new Promise<string | null>((resolve) => (resolveModel = resolve))),
    };
    const run = maybeAutoTitleSession(p);
    await Promise.resolve();
    expect(p.applyLabel).toHaveBeenCalledTimes(1);
    expect(p.applyLabel).toHaveBeenCalledWith("Fix the Login Redirect Loop");
    resolveModel("Login Redirect Loop Fix");
    await run;
    expect(p.applyLabel).toHaveBeenCalledTimes(2);
  });

  it("keeps a rename the user made while the model was thinking", async () => {
    const p = {
      ...baseParams(),
      readCurrentLabel: vi.fn(async () => "My Login Notes"),
    };
    await maybeAutoTitleSession(p);
    expect(p.applyLabel).toHaveBeenCalledTimes(1);
    expect(p.applyLabel).toHaveBeenCalledWith("Fix the Login Redirect Loop");
  });

  it("still upgrades when the current label is the heuristic it applied", async () => {
    const p = {
      ...baseParams(),
      readCurrentLabel: vi.fn(async () => "Fix the Login Redirect Loop"),
    };
    await maybeAutoTitleSession(p);
    expect(p.applyLabel).toHaveBeenCalledTimes(2);
    expect(p.applyLabel).toHaveBeenLastCalledWith("Login Redirect Loop Fix");
  });

  it("skips ineligible sessions", async () => {
    const p = { ...baseParams(), sessionKey: "discord:123" };
    await maybeAutoTitleSession(p);
    expect(p.applyLabel).not.toHaveBeenCalled();
  });

  it("skips sessions that already have a label", async () => {
    const p = { ...baseParams(), existingLabel: "Existing" };
    await maybeAutoTitleSession(p);
    expect(p.applyLabel).not.toHaveBeenCalled();
  });

  it("skips sessions that already have prior conversation (continuing an old chat)", async () => {
    const p = { ...baseParams(), priorMessageCount: 4 };
    await maybeAutoTitleSession(p);
    expect(p.applyLabel).not.toHaveBeenCalled();
    expect(p.generateLabel).not.toHaveBeenCalled();
  });

  it("titles a new session whose prior message count is zero", async () => {
    const p = { ...baseParams(), priorMessageCount: 0 };
    await maybeAutoTitleSession(p);
    expect(p.applyLabel).toHaveBeenCalledTimes(2);
    expect(p.applyLabel).toHaveBeenLastCalledWith("Login Redirect Loop Fix");
  });

  it("applies only the heuristic when no generator is provided", async () => {
    const p = { ...baseParams(), generateLabel: undefined };
    await maybeAutoTitleSession(p);
    expect(p.applyLabel).toHaveBeenCalledTimes(1);
  });

  it("keeps the heuristic label when the generator throws", async () => {
    const onError = vi.fn();
    const p = {
      ...baseParams(),
      generateLabel: vi.fn(async () => {
        throw new Error("llm down");
      }),
      onError,
    };
    await maybeAutoTitleSession(p);
    expect(p.applyLabel).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("does not re-apply when the refined title matches the heuristic", async () => {
    const p = {
      ...baseParams(),
      message: "Login Redirect Loop Fix",
      generateLabel: vi.fn(async () => "login redirect loop fix"),
    };
    await maybeAutoTitleSession(p);
    expect(p.applyLabel).toHaveBeenCalledTimes(1);
  });
});
