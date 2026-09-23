import { describe, expect, it } from "vitest";
import type { SkillStatusEntry } from "../types.ts";
import { buildWelcomeSuggestions, PRIMARY_WELCOME_PROMPT } from "./welcome-suggestions.ts";

function skill(skillKey: string, overrides: Partial<SkillStatusEntry> = {}): SkillStatusEntry {
  return {
    skillKey,
    name: skillKey,
    disabled: false,
    eligible: true,
    blockedByAllowlist: false,
    ...overrides,
  } as SkillStatusEntry;
}

describe("empty chat suggestions", () => {
  // The old four were fixed and three were operator tasks: on a first run the
  // product asked people to summarise sessions they did not have and check the
  // health of a system they had never heard of.
  it("never suggests operator chores", () => {
    const all = buildWelcomeSuggestions({ skills: [skill("weather"), skill("reminders")] }).join(
      " ",
    );
    for (const chore of ["recent sessions", "system health", "configure a channel"]) {
      expect(all.toLowerCase()).not.toContain(chore);
    }
  });

  it("suggests what the enabled skills can actually do", () => {
    const suggestions = buildWelcomeSuggestions({
      skills: [skill("weather"), skill("reminders")],
      seed: 0,
      max: 8,
    });
    expect(suggestions.some((s) => /weather|rain/i.test(s))).toBe(true);
    expect(suggestions.some((s) => /remind/i.test(s))).toBe(true);
  });

  it("does not suggest a skill that is switched off", () => {
    const suggestions = buildWelcomeSuggestions({
      skills: [skill("weather", { disabled: true }), skill("reminders")],
      max: 8,
    });
    expect(suggestions.some((s) => /weather|rain/i.test(s))).toBe(false);
  });

  it("does not suggest skills that need an account nobody has connected", () => {
    const suggestions = buildWelcomeSuggestions({
      skills: [skill("gog"), skill("spotify-player"), skill("notion"), skill("trello")],
      max: 8,
    }).join(" ");
    expect(/gmail|calendar|spotify|notion|trello/i.test(suggestions)).toBe(false);
  });

  it("still offers something useful on an install with no skills", () => {
    const suggestions = buildWelcomeSuggestions({ skills: [] });
    expect(suggestions[0]).toBe(PRIMARY_WELCOME_PROMPT);
    expect(suggestions.length).toBeGreaterThan(1);
  });

  it("keeps the same opener but rotates the rest", () => {
    const skills = [skill("weather"), skill("reminders"), skill("quick-notes")];
    const monday = buildWelcomeSuggestions({ skills, seed: 1 });
    const tuesday = buildWelcomeSuggestions({ skills, seed: 2 });
    expect(monday[0]).toBe(PRIMARY_WELCOME_PROMPT);
    expect(tuesday[0]).toBe(PRIMARY_WELCOME_PROMPT);
    expect(monday.slice(1)).not.toEqual(tuesday.slice(1));
  });

  it("never repeats a suggestion", () => {
    const suggestions = buildWelcomeSuggestions({
      skills: [skill("weather"), skill("weather"), skill("reminders")],
      max: 6,
    });
    expect(new Set(suggestions).size).toBe(suggestions.length);
  });
});
