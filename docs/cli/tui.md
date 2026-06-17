---
summary: "CLI reference for `daisyclaw tui` (Gateway-backed or local embedded terminal UI)"
read_when:
  - You want a terminal UI for the Gateway (remote-friendly)
  - You want to pass url/token/session from scripts
  - You want to run the TUI in local embedded mode without a Gateway
  - You want to use daisyclaw chat or daisyclaw tui --local
title: "TUI"
---

# `daisyclaw tui`

Open the terminal UI connected to the Gateway, or run it in local embedded
mode.

Related:

- TUI guide: [TUI](/web/tui)

## Options

| Flag                  | Default                                   | Description                                                                        |
| --------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------- |
| `--local`             | `false`                                   | Run against the local embedded agent runtime instead of a Gateway.                 |
| `--url <url>`         | `gateway.remote.url` from config          | Gateway WebSocket URL.                                                             |
| `--token <token>`     | (none)                                    | Gateway token if required.                                                         |
| `--password <pass>`   | (none)                                    | Gateway password if required.                                                      |
| `--session <key>`     | `main` (or `global` when scope is global) | Session key. Inside an agent workspace it auto-selects that agent unless prefixed. |
| `--deliver`           | `false`                                   | Deliver assistant replies through configured channels.                             |
| `--thinking <level>`  | (model default)                           | Thinking level override.                                                           |
| `--message <text>`    | (none)                                    | Send an initial message after connecting.                                          |
| `--timeout-ms <ms>`   | `agents.defaults.timeoutSeconds`          | Agent timeout. Invalid values log a warning and are ignored.                       |
| `--history-limit <n>` | `200`                                     | History entries to load on attach.                                                 |

Aliases: `daisyclaw chat` and `daisyclaw terminal` invoke the same command with `--local` implied.

Notes:

- `chat` and `terminal` are aliases for `daisyclaw tui --local`.
- `--local` cannot be combined with `--url`, `--token`, or `--password`.
- `tui` resolves configured gateway auth SecretRefs for token/password auth when possible (`env`/`file`/`exec` providers).
- When launched from inside a configured agent workspace directory, TUI auto-selects that agent for the session key default (unless `--session` is explicitly `agent:<id>:...`).
- To show the Gateway hostname in the footer for non-local URL-backed connections, run `daisyclaw config set tui.footer.showRemoteHost true`. The host label is off by default and never appears for loopback or embedded local connections.
- Local mode uses the embedded agent runtime directly. Most local tools work, but Gateway-only features are unavailable.
- Local mode adds `/auth [provider]` inside the TUI command surface.
- Plugin approval gates still apply in local mode. Tools that require approval prompt for a decision in the terminal; nothing is silently auto-approved because the Gateway is not involved.
- Session [goals](/tools/goal) appear in the footer and can be managed with `/goal`.

## Examples

```bash
daisyclaw chat
daisyclaw tui --local
daisyclaw tui
daisyclaw tui --url ws://127.0.0.1:18789 --token <token>
daisyclaw tui --session main --deliver
daisyclaw chat --message "Compare my config to the docs and tell me what to fix"
# when run inside an agent workspace, infers that agent automatically
daisyclaw tui --session bugfix
```

## Config repair loop

Use local mode when the current config already validates and you want the
embedded agent to inspect it, compare it against the docs, and help repair it
from the same terminal:

If `daisyclaw config validate` is already failing, use `daisyclaw configure` or
`daisyclaw doctor --fix` first. `daisyclaw chat` does not bypass the invalid-
config guard.

```bash
daisyclaw chat
```

Then inside the TUI:

```text
!daisyclaw config file
!daisyclaw docs gateway auth token secretref
!daisyclaw config validate
!daisyclaw doctor
```

Apply targeted fixes with `daisyclaw config set` or `daisyclaw configure`, then
rerun `daisyclaw config validate`. See [TUI](/web/tui) and [Config](/cli/config).

## Related

- [CLI reference](/cli)
- [TUI](/web/tui)
- [Goal](/tools/goal)
