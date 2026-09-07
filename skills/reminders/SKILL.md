---
name: reminders
description: "Set, list, and cancel one-shot or recurring reminders delivered to the user's chat channel via cron."
metadata:
  {
    "daisyclaw":
      {
        "emoji": "⏰",
        "highlights":
          [
            "Set one-time reminders — 'remind me at 6pm to call mom'",
            "Set repeating ones — 'every weekday at 9am'",
            "Deliver them to the same chat you asked from",
            "List, change, or cancel anything you've set",
          ],
      },
  }
---

# Reminders

Use the `cron` tool to set reminders. Never emulate scheduling with sleep or
polling. Reminders created from a chat channel deliver back to that same
channel automatically (delivery is inferred from the current conversation).

## One-shot reminder ("remind me at 6pm to call mom")

Resolve the user's requested time to an ISO-8601 timestamp first. Times the
user gives are in their local timezone; ISO timestamps without a timezone are
treated as UTC, so include the offset.

```json
{
  "action": "add",
  "job": {
    "name": "Call mom",
    "schedule": { "kind": "at", "at": "2026-09-02T18:00:00+05:30" },
    "payload": {
      "kind": "agentTurn",
      "message": "Remind the user now: call mom. Send a short, friendly reminder message."
    },
    "deleteAfterRun": true
  }
}
```

## Recurring reminder ("every weekday at 9am")

Use a cron expression in the user's local wall-clock time with an IANA `tz`.
Do not convert to UTC.

```json
{
  "action": "add",
  "job": {
    "name": "Standup reminder",
    "schedule": { "kind": "cron", "expr": "0 9 * * 1-5", "tz": "Asia/Kolkata" },
    "payload": {
      "kind": "agentTurn",
      "message": "Remind the user now: daily standup in 15 minutes."
    }
  }
}
```

## Manage reminders

- List: `{ "action": "list" }` — summarize job names and next run times in plain language.
- Cancel: `{ "action": "remove", "jobId": "<id from list>" }`.
- Reschedule: `{ "action": "update", "jobId": "<id>", "patch": { "schedule": { ... } } }`.

## Behavior

- Confirm each reminder back to the user with the resolved local time ("OK — I'll remind you tomorrow at 6:00 PM").
- If the requested time is ambiguous ("remind me at 8"), ask AM or PM.
- If the time is in the past, ask whether they meant tomorrow.
- Phrase the payload message as an instruction to the future agent ("Remind the user now: ..."), not as the reminder text itself.
- Add `"contextMessages": 3` to the add call when the reminder refers to the current conversation ("remind me about this later").
