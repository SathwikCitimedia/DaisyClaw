/**
 * The consumer product is one thing called Daisy. Internal or upstream brand
 * names must never reach a user, in chat or in the app.
 *
 * "ClawHub" is the skill registry's own name. It reached chat because the
 * skill-installer skill — which ships enabled in the consumer pack — carried it
 * in the text the model reads, so Daisy repeated it back to users who have
 * never heard of it.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SKILL_PACK_CONNECT,
  DEFAULT_SKILL_PACK_INSTANT,
  DEFAULT_SKILL_PACK_SELF_GATED,
} from "./default-skill-pack.js";

/** Brand names that must not appear in anything a consumer can be shown. */
const FORBIDDEN_IN_CONSUMER_COPY = [/clawhub/i];

const repoRoot = path.resolve(import.meta.dirname, "../..");

/** Skills a consumer install ships enabled, so the model reads their text. */
const ENABLED_FOR_CONSUMERS = [
  ...DEFAULT_SKILL_PACK_INSTANT,
  ...DEFAULT_SKILL_PACK_CONNECT,
  ...DEFAULT_SKILL_PACK_SELF_GATED,
];

describe("consumer-visible skill text", () => {
  it("ships at least the instant tier, so this test is actually reading something", () => {
    expect(ENABLED_FOR_CONSUMERS.length).toBeGreaterThan(8);
  });

  for (const skill of ENABLED_FOR_CONSUMERS) {
    const file = path.join(repoRoot, "skills", skill, "SKILL.md");
    if (!fs.existsSync(file)) {
      continue;
    }
    it(`${skill} names no internal brand`, () => {
      const text = fs.readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN_IN_CONSUMER_COPY) {
        expect(
          pattern.test(text),
          `skills/${skill}/SKILL.md matches ${pattern}; the model reads this file and repeats the word to users`,
        ).toBe(false);
      }
    });
  }
});
