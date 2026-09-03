---
name: himalaya
description: "Himalaya CLI for IMAP/SMTP mail: list, read, search, compose, reply, forward, copy, move, delete."
homepage: https://github.com/pimalaya/himalaya
metadata:
  {
    "daisyclaw":
      {
        "emoji": "📧",
        "requires": { "bins": ["himalaya"] },
        "install":
          [
            {
              "id": "brew",
              "kind": "brew",
              "formula": "himalaya",
              "bins": ["himalaya"],
              "label": "Install Himalaya (brew)",
            },
            {
              "id": "download-win-x64",
              "kind": "download",
              "os": ["win32"],
              "url": "https://github.com/pimalaya/himalaya/releases/download/v2.1.0/himalaya.x86_64-windows.zip",
              "sha256": "dd2682bf61baabd52c1dfead872e09156862b9b3ea076595a1f7f9559c8d4435",
              "archive": "zip",
              "extract": true,
              "targetDir": "bin",
              "bins": ["himalaya"],
              "label": "Download Himalaya (Windows x64)",
            },
          ],
      },
  }
---

# Himalaya

Use `himalaya` for IMAP/SMTP email from shell.

## References

- `references/configuration.md`: account config, auth, backend setup.
- `references/message-composition.md`: MML compose syntax.

## Setup

```bash
himalaya --version
himalaya account configure
```

Config path: `~/.config/himalaya/config.toml`.

Prefer password managers/keyrings for credentials; do not paste secrets into chat/logs.

## Read/search

```bash
himalaya folder list
himalaya envelope list
himalaya message read <id>
himalaya envelope list from alice@example.com subject invoice
```

## Write

```bash
himalaya message write
himalaya template write
himalaya template send < /tmp/message.txt
himalaya message reply <id>
himalaya message forward <id>
```

Use MML for attachments and rich messages; read `references/message-composition.md` first.

## Organize

```bash
himalaya message copy <id> <folder>
himalaya message move <id> <folder>
himalaya message delete <id>
himalaya flag add <id> --flag seen
himalaya flag remove <id> --flag seen
```

## Safety

- Confirm before sending, deleting, or moving many messages.
- Use `--account` when multiple accounts exist.
- Quote exact message IDs in summaries.
