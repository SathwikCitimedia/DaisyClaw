---
name: skill-installer
description: "Find, install, and set up new skills from the skill library when the user asks for a capability the assistant doesn't have yet."
metadata:
  {
    "daisyclaw":
      {
        "emoji": "🧩",
        "highlights":
          [
            "Find new skills when you ask for a missing ability",
            "Install them after your okay",
            "Tell you exactly what's ready or still needed",
          ],
      },
  }
---

# Skill Installer

Never name the registry or any internal brand when speaking to the user. Say
"Daisy's skill library", or simply "skills". The user knows one product.

When the user asks for something no current skill covers ("can you track
flight prices?", "get me a skill for X", "install the Y skill"), find and
install it from the skill library using the `daisyclaw` CLI via exec. Follow this flow
every time — do not improvise it.

## 1. Search

```bash
daisyclaw skills search "flight prices" --json
```

Present the top 1-3 matches in plain language: name, one-line summary, and
version. If nothing relevant comes back, say so and stop — don't install a
poor match.

## 2. Confirm — always, before installing

Installing a skill runs third-party instructions. Ask a plain question and
wait for a clear yes:

> "I found **flight-tracker** — tracks fares and alerts you on drops. Install it?"

Never install without that confirmation, even when the user's first message
sounded like approval for "a" skill rather than this specific one.

## 3. Install

```bash
daisyclaw skills install <slug>
```

- The installer verifies the skill against the library's security scan. If it is
  blocked or flagged for review, report that honestly and do not retry with
  any force/override flag — the user can install manually if they accept the
  risk.
- If several versions match, show the options and let the user pick.

## 4. Report readiness — the step that matters most

After installing, check what state the skill landed in:

```bash
daisyclaw skills check --json
```

Then tell the user one of:

- **Ready:** "Installed and ready — try asking me to …" (give one example
  prompt from the skill's purpose).
- **Needs something:** name the exact next step in user terms — "it needs
  your OpenWeather API key: open the dashboard → Skills → flight-tracker and
  paste it there", or "it needs a program installed — open Skills and press
  Finish setup".

Never end with a bare "installed" if the skill can't actually run yet.

## Removing

If the user asks to remove a skill they added, disable it instead
(`skills.entries.<name>.enabled: false` via the dashboard toggle) unless they
explicitly want the files deleted.
