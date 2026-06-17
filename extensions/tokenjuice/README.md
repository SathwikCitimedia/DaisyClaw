# @daisyclaw/tokenjuice

Official Tokenjuice output compaction plugin for DaisyClaw.

Tokenjuice compacts noisy `exec` and `bash` tool results after commands run, before the result is fed back into the active agent session. It does not rewrite commands, rerun commands, or change exit codes.

## Install

```bash
daisyclaw plugins install @daisyclaw/tokenjuice
```

Restart the Gateway after installing or updating the plugin.

## Enable

```bash
daisyclaw config set plugins.entries.tokenjuice.enabled true
```

Equivalent:

```bash
daisyclaw plugins enable tokenjuice
```

## Docs

- https://docs.daisyclaw.ai/tools/tokenjuice

## Package

- Plugin id: `tokenjuice`
- Package: `@daisyclaw/tokenjuice`
- Minimum DaisyClaw host: `2026.5.28`
