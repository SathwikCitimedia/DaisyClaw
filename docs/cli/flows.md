---
summary: "Redirect: flow commands live under `daisyclaw tasks flow`"
read_when:
  - You encounter `daisyclaw flows` in older docs or release notes
  - You want a quick TaskFlow inspection reference
title: "Flows (redirect)"
---

# `daisyclaw tasks flow`

There is no top-level `daisyclaw flows` command. Durable TaskFlow inspection lives under `daisyclaw tasks flow`.

## Subcommands

```bash
daisyclaw tasks flow list   [--json] [--status <name>]
daisyclaw tasks flow show   <lookup> [--json]
daisyclaw tasks flow cancel <lookup>
```

| Subcommand | Description                | Arguments / options                                                                   |
| ---------- | -------------------------- | ------------------------------------------------------------------------------------- |
| `list`     | List tracked TaskFlows.    | `--json` machine-readable output; `--status <name>` filter (see status values below). |
| `show`     | Show one TaskFlow.         | `<lookup>` flow id or owner key; `--json` machine-readable output.                    |
| `cancel`   | Cancel a running TaskFlow. | `<lookup>` flow id or owner key.                                                      |

`<lookup>` accepts either a flow id (returned by `list` / `show`) or the flow's owner key (the stable identifier the owning subsystem uses to track the flow).

### Status filter values

`--status` on `list` accepts one of:

`queued`, `running`, `waiting`, `blocked`, `succeeded`, `failed`, `cancelled`, `lost`

## Examples

```bash
daisyclaw tasks flow list
daisyclaw tasks flow list --status running
daisyclaw tasks flow list --json
daisyclaw tasks flow show flow_abc123
daisyclaw tasks flow show flow_abc123 --json
daisyclaw tasks flow cancel flow_abc123
```

For full TaskFlow concepts and authoring see [TaskFlow](/automation/taskflow). For the parent `tasks` command see [tasks CLI reference](/cli/tasks).

## Related

- [CLI reference](/cli)
- [Automation](/automation)
- [TaskFlow](/automation/taskflow)
