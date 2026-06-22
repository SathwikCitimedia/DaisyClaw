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

  it("applies heuristic then refined label for an eligible, untitled session", async () => {
    const p = baseParams();
    await maybeAutoTitleSession(p);
    expect(p.applyLabel).toHaveBeenCalledTimes(2);
    expect(p.applyLabel).toHaveBeenNthCalledWith(1, "Help me fix the login redirect loop");
    expect(p.applyLabel).toHaveBeenNthCalledWith(2, "Login Redirect Loop Fix");
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
