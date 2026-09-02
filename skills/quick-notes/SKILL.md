---
name: quick-notes
description: "Save, search, list, and recall the user's notes as Markdown files in the workspace."
metadata: { "daisyclaw": { "emoji": "🗒️" } }
---

# Quick Notes

Persist the user's notes as Markdown files under `notes/` in the agent
workspace (create the folder on first use). Use the file read/write/edit
tools; no external services or accounts.

## Layout

- One file per topic: `notes/<topic-slug>.md` (kebab-case, e.g. `notes/gift-ideas.md`).
- Untitled quick captures go to `notes/inbox.md`, newest entry first.
- Every entry starts with a `## <ISO date>` heading so entries stay ordered
  and searchable:

```markdown
## 2026-09-02

- Priya's birthday is Oct 14 — she liked the blue ceramic set.
```

## Actions

- **Save** ("note this down", "remember that ..."): append an entry to the
  matching topic file, or `inbox.md` when no topic fits. Confirm with the
  file it was saved to.
- **Recall** ("what did I note about X"): search `notes/` for the term (file
  names first, then content), then answer from the matching entries — quote
  the note, not the file path.
- **List** ("show my notes"): list topic files with a one-line summary each.
- **Edit/delete**: update or remove only the specific entry the user names;
  never rewrite a whole file for a one-line change.

## Behavior

- Notes are the user's words — save their meaning faithfully, condensed, not
  embellished. Keep dates the user mentions as absolute dates.
- Don't duplicate: if an entry for the same fact exists, update it instead.
- These files belong to the user. Never delete or overwrite `notes/` content
  beyond what they asked for.
