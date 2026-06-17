---
summary: "Gateway runtime on macOS (external launchd service)"
read_when:
  - Packaging DaisyClaw.app
  - Debugging the macOS gateway launchd service
  - Installing the gateway CLI for macOS
title: "Gateway on macOS"
---

DaisyClaw.app no longer bundles Node/Bun or the Gateway runtime. The macOS app
expects an **external** `daisyclaw` CLI install, does not spawn the Gateway as a
child process, and manages a per-user launchd service to keep the Gateway
running (or attaches to an existing local Gateway if one is already running).

## Install the CLI (required for local mode)

Node 24 is the default runtime on the Mac. Node 22 LTS, currently `22.19+`, still works for compatibility. Then install `daisyclaw` globally:

```bash
npm install -g daisyclaw@<version>
```

The macOS app's **Install CLI** button runs the same global install flow the app
uses internally: it prefers npm first, then pnpm, then bun if that is the only
detected package manager. Node remains the recommended Gateway runtime.

## Launchd (Gateway as LaunchAgent)

Label:

- `ai.daisyclaw.gateway` (or `ai.daisyclaw.<profile>`; legacy `com.daisyclaw.*` may remain)

Plist location (per-user):

- `~/Library/LaunchAgents/ai.daisyclaw.gateway.plist`
  (or `~/Library/LaunchAgents/ai.daisyclaw.<profile>.plist`)

Manager:

- The macOS app owns LaunchAgent install/update in Local mode.
- The CLI can also install it: `daisyclaw gateway install`.

Behavior:

- "DaisyClaw Active" enables/disables the LaunchAgent.
- App quit does **not** stop the gateway (launchd keeps it alive).
- If a Gateway is already running on the configured port, the app attaches to
  it instead of starting a new one.

Logging:

- launchd stdout: `~/Library/Logs/daisyclaw/gateway.log` (profiles use `gateway-<profile>.log`)
- launchd stderr: suppressed

## Version compatibility

The macOS app checks the gateway version against its own version. If they're
incompatible, update the global CLI to match the app version.

## Smoke check

```bash
daisyclaw --version

DAISYCLAW_SKIP_CHANNELS=1 \
DAISYCLAW_SKIP_CANVAS_HOST=1 \
daisyclaw gateway --port 18999 --bind loopback
```

Then:

```bash
daisyclaw gateway call health --url ws://127.0.0.1:18999 --timeout 3000
```

## Related

- [macOS app](/platforms/macos)
- [Gateway runbook](/gateway)
