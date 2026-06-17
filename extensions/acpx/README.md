# @daisyclaw/acpx

Official ACP runtime backend for DaisyClaw.

ACPx lets DaisyClaw run external coding harnesses through the Agent Client Protocol while DaisyClaw still owns sessions, channels, delivery, permissions, and Gateway state.

## Install

```bash
daisyclaw plugins install @daisyclaw/acpx
```

Restart the Gateway after installing or updating the plugin.

## What it provides

- ACP-backed agent runtime sessions.
- Plugin-owned session and transport management.
- MCP bridge helpers for DaisyClaw tools and plugin tools.
- Static runtime assets used by the ACP process bridge.

## Configure

Use the ACP docs for harness-specific setup, permission modes, and model/runtime selection:

- https://docs.daisyclaw.ai/tools/acp-agents-setup
- https://docs.daisyclaw.ai/tools/acp-agents

## Package

- Plugin id: `acpx`
- Package: `@daisyclaw/acpx`
- Minimum DaisyClaw host: `2026.4.25`
