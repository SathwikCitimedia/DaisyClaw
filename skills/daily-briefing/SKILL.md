---
name: daily-briefing
description: "Compose and schedule a personal morning briefing: weather, today's reminders, and recent notes."
metadata: { "daisyclaw": { "emoji": "🌅" } }
---

# Daily Briefing

Build a short personal briefing on request ("what's my day look like?") or on
a schedule ("send me a briefing every morning at 7").

## Composing a briefing

Gather what is available — skip sections silently when a source is missing:

1. **Weather** — today's forecast for the user's city (see the `weather`
   skill). Ask for their city once, then save it with the `quick-notes` skill
   (`notes/preferences.md`) and reuse it.
2. **Today's reminders** — `cron` tool `{ "action": "list" }`; mention jobs
   whose next run is today, in plain language.
3. **Recent notes** — anything added to `notes/` in the last day worth
   resurfacing.
4. **Date context** — the date, and anything notable the user previously
   asked to track.

Format: a compact chat message — greeting, 3-6 short lines, no headers, no
filler. Lead with the most actionable item.

## Scheduling it

Create a recurring cron job in the user's local timezone (wall-clock `expr`,
IANA `tz` — do not convert to UTC):

```json
{
  "action": "add",
  "job": {
    "name": "Daily briefing",
    "schedule": { "kind": "cron", "expr": "0 7 * * *", "tz": "Asia/Kolkata" },
    "payload": {
      "kind": "agentTurn",
      "message": "Compose the user's daily briefing per the daily-briefing skill and send it."
    }
  }
}
```

Delivery defaults to the channel the user scheduled it from. Confirm the
schedule back in local time, and point out it can be stopped anytime
("stop my daily briefing" → `cron` `remove` on that job).
