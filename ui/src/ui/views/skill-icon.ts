// Control UI view module picks the outline icon that stands for a skill, so a
// skill looks the same on the Skills page and in Settings > Connections.
import type { TemplateResult } from "lit";
import { icons, type IconName } from "../icons.ts";
import type { SkillStatusEntry } from "../types.ts";

// Skill cards show a consistent outline icon instead of the per-skill emoji.
// Pick by emoji category first, then by name/description keywords.
const SKILL_EMOJI_ICONS: Array<[RegExp, IconName]> = [
  [/[\u{1F512}\u{1F510}\u{1F511}\u{1F5DD}]/u, "lock"],
  [/[\u{1F4DD}\u{1F5D2}\u{1F4CB}\u{1F4C4}\u{1F4C3}]/u, "fileText"],
  [/[\u{23F0}\u{23F1}\u{23F2}\u{1F550}-\u{1F567}]/u, "clock"],
  [/[\u{1F4C5}\u{1F4C6}\u{1F5D3}]/u, "calendarClock"],
  [/[\u{1F4F7}\u{1F4F8}\u{1F3A5}\u{1F4F9}]/u, "camera"],
  [/[\u{1F3B5}\u{1F3B6}\u{1F3A7}\u{1F3BC}]/u, "music"],
  [/[\u{2709}\u{1F4E7}\u{1F4E8}\u{1F4EC}\u{1F4EE}]/u, "mail"],
  [/[\u{1F4E1}\u{1F4F0}]/u, "rss"],
  [/[\u{1F310}\u{1F30D}\u{1F30E}\u{1F30F}]/u, "globe"],
  [/[\u{1F4AC}\u{1F5E8}]/u, "messageSquare"],
  [/[\u{1F50D}\u{1F50E}]/u, "search"],
  [/[\u{1F5A5}\u{1F4BB}\u{1F5A8}]/u, "monitor"],
  [/\u{1F4F1}/u, "smartphone"],
  [/[\u{1F6E0}\u{1F527}\u{1F528}\u{2699}]/u, "wrench"],
  [/\u{26A1}/u, "zap"],
  [/\u{1F9E0}/u, "brain"],
  [/[\u{1F4DA}\u{1F4D6}]/u, "book"],
  [/[\u{1F5C4}\u{1F4BE}\u{1F5C3}]/u, "database"],
  [/\u{1F3A8}/u, "palette"],
  [/\u{1F916}/u, "bot"],
  [/[\u{1F465}\u{1F464}]/u, "users"],
  [/\u{1F5BC}/u, "image"],
  [/[\u{1F399}\u{1F3A4}]/u, "mic"],
  [/[\u{1F50A}\u{1F509}]/u, "volume2"],
  [/\u{1F4E6}/u, "archive"],
];

const SKILL_KEYWORD_ICONS: Array<[RegExp, IconName]> = [
  [/password|secret|vault|credential|auth/i, "lock"],
  [/remind|calendar|schedule/i, "calendarClock"],
  [/note|memo|journal/i, "penLine"],
  [/camera|rtsp|onvif|snapshot|photo/i, "camera"],
  [/blog|rss|feed|news/i, "rss"],
  [/music|audio|playback|sound|volume|speaker/i, "music"],
  [/mail|email|inbox/i, "mail"],
  [/chat|message|sms/i, "messageSquare"],
  [/search|find|lookup/i, "search"],
  [/browser|web|http|url|site/i, "globe"],
  [/database|sql|sqlite|postgres/i, "database"],
  [/file|document|pdf|doc/i, "fileText"],
  [/image|picture|draw|canvas|paint/i, "image"],
  [/voice|speech|transcri|mic/i, "mic"],
  [/video|screen|display|monitor/i, "monitor"],
  [/phone|mobile|device/i, "smartphone"],
  [/time|clock|timer/i, "clock"],
  [/book|read|library|docs/i, "book"],
  [/terminal|shell|cli|command/i, "terminal"],
  [/git|code|repo|dev/i, "code"],
];

export function skillOutlineIcon(skill: SkillStatusEntry): TemplateResult {
  const emoji = skill.emoji ?? "";
  for (const [pattern, name] of SKILL_EMOJI_ICONS) {
    if (pattern.test(emoji)) {
      return icons[name];
    }
  }
  const haystack = `${skill.name} ${skill.description}`;
  for (const [pattern, name] of SKILL_KEYWORD_ICONS) {
    if (pattern.test(haystack)) {
      return icons[name];
    }
  }
  return icons.puzzle;
}
