// What to offer someone staring at an empty chat.
//
// The four suggestions used to be fixed, and three of them were operator tasks:
// "Summarize my recent sessions" and "Check system health" on a first run, when
// there are no sessions and the user has never heard of a gateway. They are now
// built from the skills this install actually has switched on, so the chips can
// only ever suggest something Daisy can really do.
import type { SkillStatusEntry } from "../types.ts";

/** Openers that need no skill at all, so they work on every install. */
const UNIVERSAL_PROMPTS: readonly string[] = [
  "Help me write a polite reply to a message",
  "Give me three ideas for dinner tonight",
  "Explain something to me in simple words",
  "Help me plan my week",
];

/**
 * Example requests per skill, in the words a person would use.
 *
 * Written here rather than read from each skill's highlights because those are
 * descriptions of the skill ("Tell you the current weather in any city"), not
 * things anybody would type. Where a highlight already contained a spoken
 * example, that phrasing is kept.
 */
const SKILL_PROMPTS: Readonly<Record<string, readonly string[]>> = {
  weather: ["What's the weather like tomorrow?", "Will it rain this weekend?"],
  reminders: ["Remind me at 6pm to call mom", "Remind me every weekday at 9am to check email"],
  "quick-notes": ["Note this down for me", "What did I note about the house?"],
  "daily-briefing": ["What does my day look like?", "Send me a morning summary at 8am"],
  "diagram-maker": ["Draw a flowchart of how my morning goes", "Sketch a simple mind map for me"],
  "meme-maker": ["Make me a meme about Mondays", "Find a meme for finishing a big project"],
  taskflow: ["Keep track of a few things for me", "What's still on my list?"],
  summarize: ["Summarise this link for me", "Give me the short version of this article"],
  canvas: ["Show me that on a board", "Draw this out so I can see it"],
  "skill-installer": ["What else can you learn to do?"],
};

/**
 * Skills that need an account connected before they can answer. Suggesting them
 * on a fresh install produces a failure on the user's very first try, which
 * reads as the assistant being broken rather than a missing connection.
 */
const NEEDS_CONNECTION = new Set(["gog", "spotify-player", "notion", "trello"]);

/** The opener that is always offered first. */
export const PRIMARY_WELCOME_PROMPT = "What can you help me with?";

function isUsable(skill: SkillStatusEntry): boolean {
  return skill.disabled !== true && skill.eligible !== false && !skill.blockedByAllowlist;
}

/**
 * Suggestions for the empty chat: the standing opener, then a rotating pick
 * from whatever this install can do. `seed` changes the rotation, so the same
 * person does not see the same three ideas every time.
 */
export function buildWelcomeSuggestions(params: {
  skills?: readonly SkillStatusEntry[];
  seed?: number;
  max?: number;
}): string[] {
  const max = Math.max(1, params.max ?? 4);
  const pool: string[] = [];

  for (const skill of params.skills ?? []) {
    const key = skill.skillKey?.trim().toLowerCase();
    if (!key || NEEDS_CONNECTION.has(key) || !isUsable(skill)) {
      continue;
    }
    for (const prompt of SKILL_PROMPTS[key] ?? []) {
      pool.push(prompt);
    }
  }

  // Universal openers always take part, so a install with nothing switched on
  // still offers something sensible rather than an empty row.
  pool.push(...UNIVERSAL_PROMPTS);

  const unique = [...new Set(pool)];
  const suggestions = [PRIMARY_WELCOME_PROMPT];
  if (unique.length === 0) {
    return suggestions;
  }
  const offset = Math.abs(Math.trunc(params.seed ?? 0)) % unique.length;
  for (let step = 0; step < unique.length && suggestions.length < max; step += 1) {
    const candidate = unique[(offset + step) % unique.length];
    if (candidate && !suggestions.includes(candidate)) {
      suggestions.push(candidate);
    }
  }
  return suggestions;
}
