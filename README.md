# 🦞 DaisyClaw — Personal AI Assistant

<p align="center">
    <picture>
        <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/daisyclaw/daisyclaw/main/docs/assets/daisyclaw-logo-text-dark.svg">
        <img src="https://raw.githubusercontent.com/daisyclaw/daisyclaw/main/docs/assets/daisyclaw-logo-text.svg" alt="DaisyClaw" width="500">
    </picture>
</p>

<p align="center">
  <strong>EXFOLIATE! EXFOLIATE!</strong>
</p>

<p align="center">
  <a href="https://github.com/daisyclaw/daisyclaw/actions/workflows/ci.yml?branch=main"><img src="https://img.shields.io/github/actions/workflow/status/daisyclaw/daisyclaw/ci.yml?branch=main&style=for-the-badge" alt="CI status"></a>
  <a href="https://github.com/daisyclaw/daisyclaw/releases"><img src="https://img.shields.io/github/v/release/daisyclaw/daisyclaw?include_prereleases&style=for-the-badge" alt="GitHub release"></a>
  <a href="https://discord.gg/clawd"><img src="https://img.shields.io/discord/1456350064065904867?label=Discord&logo=discord&logoColor=white&color=5865F2&style=for-the-badge" alt="Discord"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

**DaisyClaw** is a _personal AI assistant_ you run on your own devices.
It answers you on the channels you already use. It can speak and listen on macOS/iOS/Android, and can render a live Canvas you control. The Gateway is just the control plane — the product is the assistant.

If you want a personal, single-user assistant that feels local, fast, and always-on, this is it.

Supported channels include: WhatsApp, Telegram, Slack, Discord, Google Chat, Signal, iMessage, IRC, Microsoft Teams, Matrix, Feishu, LINE, Mattermost, Nextcloud Talk, Nostr, Synology Chat, Tlon, Twitch, Zalo, Zalo Personal, WeChat, QQ, WebChat.

[Website](https://daisyclaw.ai) · [Docs](https://docs.daisyclaw.ai) · [Vision](VISION.md) · [Third-party notices](THIRD_PARTY_NOTICES.md) · [DeepWiki](https://deepwiki.com/daisyclaw/daisyclaw) · [Getting Started](https://docs.daisyclaw.ai/start/getting-started) · [Updating](https://docs.daisyclaw.ai/install/updating) · [Showcase](https://docs.daisyclaw.ai/start/showcase) · [FAQ](https://docs.daisyclaw.ai/help/faq) · [Onboarding](https://docs.daisyclaw.ai/start/wizard) · [Nix](https://github.com/daisyclaw/nix-daisyclaw) · [Docker](https://docs.daisyclaw.ai/install/docker) · [Discord](https://discord.gg/clawd)

New install? Start here: [Getting started](https://docs.daisyclaw.ai/start/getting-started)

Preferred setup: run `daisyclaw onboard` in your terminal.
DaisyClaw Onboard guides you step by step through setting up the gateway, workspace, channels, and skills. It is the recommended CLI setup path and works on **macOS, Linux, and Windows**.
Windows desktop users can start with the native [Windows Hub](https://docs.daisyclaw.ai/platforms/windows) companion app for setup, tray status, chat, node mode, and local MCP mode.
Works with npm, pnpm, or bun.

## Install (recommended)

Runtime: **Node 24 (recommended) or Node 22.19+**.

```bash
npm install -g daisyclaw@latest
# or: pnpm add -g daisyclaw@latest

daisyclaw onboard --install-daemon
```

DaisyClaw Onboard installs the Gateway daemon (launchd/systemd user service) so it stays running.

## Quick start (TL;DR)

Runtime: **Node 24 (recommended) or Node 22.19+**.

Full beginner guide (auth, pairing, channels): [Getting started](https://docs.daisyclaw.ai/start/getting-started)

Recommended daemon mode:

```bash
daisyclaw onboard --install-daemon
daisyclaw gateway status
```

Foreground/debug mode:

```bash
daisyclaw gateway stop
daisyclaw gateway --port 18789 --verbose
```

Send a test message or ask the assistant after either startup mode is running:

```bash
# Send a message
daisyclaw message send --target +1234567890 --message "Hello from DaisyClaw"

# Talk to the assistant (optionally deliver back to any connected channel: WhatsApp/Telegram/Slack/Discord/Google Chat/Signal/iMessage/IRC/Microsoft Teams/Matrix/Feishu/LINE/Mattermost/Nextcloud Talk/Nostr/Synology Chat/Tlon/Twitch/Zalo/Zalo Personal/WeChat/QQ/WebChat)
daisyclaw agent --message "Ship checklist" --thinking high
```

Upgrading? [Updating guide](https://docs.daisyclaw.ai/install/updating) (and run `daisyclaw doctor`).

Models config + CLI: [Models](https://docs.daisyclaw.ai/concepts/models). Auth profile rotation + fallbacks: [Model failover](https://docs.daisyclaw.ai/concepts/model-failover).

## Security defaults (DM access)

DaisyClaw connects to real messaging surfaces. Treat inbound DMs as **untrusted input**.

Full security guide: [Security](https://docs.daisyclaw.ai/gateway/security).
Before remote exposure, use the [Gateway exposure runbook](https://docs.daisyclaw.ai/gateway/security/exposure-runbook).

Default behavior on Telegram/WhatsApp/Signal/iMessage/Microsoft Teams/Discord/Google Chat/Slack:

- **DM pairing** (`dmPolicy="pairing"` / `channels.discord.dmPolicy="pairing"` / `channels.slack.dmPolicy="pairing"`; legacy: `channels.discord.dm.policy`, `channels.slack.dm.policy`): unknown senders receive a short pairing code and the bot does not process their message.
- Approve with: `daisyclaw pairing approve <channel> <code>` (then the sender is added to a local allowlist store).
- Public inbound DMs require an explicit opt-in: set `dmPolicy="open"` and include `"*"` in the channel allowlist (`allowFrom` / `channels.discord.allowFrom` / `channels.slack.allowFrom`; legacy: `channels.discord.dm.allowFrom`, `channels.slack.dm.allowFrom`).

Run `daisyclaw doctor` to surface risky/misconfigured DM policies.

## Highlights

- **[Local-first Gateway](https://docs.daisyclaw.ai/gateway)** — single control plane for sessions, channels, tools, and events.
- **[Multi-channel inbox](https://docs.daisyclaw.ai/channels)** — WhatsApp, Telegram, Slack, Discord, Google Chat, Signal, iMessage, IRC, Microsoft Teams, Matrix, Feishu, LINE, Mattermost, Nextcloud Talk, Nostr, Synology Chat, Tlon, Twitch, Zalo, Zalo Personal, WeChat, QQ, WebChat, macOS, iOS/Android.
- **[Multi-agent routing](https://docs.daisyclaw.ai/gateway/configuration)** — route inbound channels/accounts/peers to isolated agents (workspaces + per-agent sessions).
- **[Voice Wake](https://docs.daisyclaw.ai/nodes/voicewake) + [Talk Mode](https://docs.daisyclaw.ai/nodes/talk)** — wake words on macOS/iOS and continuous voice on Android (ElevenLabs + system TTS fallback).
- **[Live Canvas](https://docs.daisyclaw.ai/platforms/mac/canvas)** — agent-driven visual workspace with [A2UI](https://docs.daisyclaw.ai/platforms/mac/canvas#canvas-a2ui).
- **[First-class tools](https://docs.daisyclaw.ai/tools)** — browser, canvas, nodes, cron, sessions, and Discord/Slack actions.
- **[Companion apps](https://docs.daisyclaw.ai/platforms)** — Windows Hub, macOS menu bar app, and iOS/Android [nodes](https://docs.daisyclaw.ai/nodes).
- **[Onboarding](https://docs.daisyclaw.ai/start/wizard) + [skills](https://docs.daisyclaw.ai/tools/skills)** — onboarding-driven setup with bundled/managed/workspace skills.

## Security model (important)

- Default: tools run on the host for the `main` session, so the agent has full access when it is just you.
- Group/channel safety: set `agents.defaults.sandbox.mode: "non-main"` to run non-`main` sessions inside sandboxes. Docker is the default sandbox backend; SSH and OpenShell backends are also available.
- Typical sandbox default: allow `bash`, `process`, `read`, `write`, `edit`, `sessions_list`, `sessions_history`, `sessions_send`, `sessions_spawn`; deny `browser`, `canvas`, `nodes`, `cron`, `discord`, `gateway`.
- Before exposing anything remotely, read [Security](https://docs.daisyclaw.ai/gateway/security), [Gateway exposure runbook](https://docs.daisyclaw.ai/gateway/security/exposure-runbook), [Sandboxing](https://docs.daisyclaw.ai/gateway/sandboxing), and [Configuration](https://docs.daisyclaw.ai/gateway/configuration).

## Operator quick refs

- Chat commands: `/status`, `/new`, `/reset`, `/compact`, `/think <level>`, `/verbose on|off`, `/trace on|off`, `/usage off|tokens|full`, `/restart`, `/activation mention|always`
- Session tools: `sessions_list`, `sessions_history`, `sessions_send`
- Skills registry: [ClawHub](https://clawhub.ai)
- Architecture overview: [Architecture](https://docs.daisyclaw.ai/concepts/architecture)

## Docs by goal

- New here: [Getting started](https://docs.daisyclaw.ai/start/getting-started), [Onboarding](https://docs.daisyclaw.ai/start/wizard), [Updating](https://docs.daisyclaw.ai/install/updating)
- Channel setup: [Channels index](https://docs.daisyclaw.ai/channels), [WhatsApp](https://docs.daisyclaw.ai/channels/whatsapp), [Telegram](https://docs.daisyclaw.ai/channels/telegram), [Discord](https://docs.daisyclaw.ai/channels/discord), [Slack](https://docs.daisyclaw.ai/channels/slack)
- Apps + nodes: [Windows Hub](https://docs.daisyclaw.ai/platforms/windows), [macOS](https://docs.daisyclaw.ai/platforms/macos), [iOS](https://docs.daisyclaw.ai/platforms/ios), [Android](https://docs.daisyclaw.ai/platforms/android), [Nodes](https://docs.daisyclaw.ai/nodes)
- Config + security: [Configuration](https://docs.daisyclaw.ai/gateway/configuration), [Security](https://docs.daisyclaw.ai/gateway/security), [Exposure runbook](https://docs.daisyclaw.ai/gateway/security/exposure-runbook), [Sandboxing](https://docs.daisyclaw.ai/gateway/sandboxing)
- Remote + web: [Gateway](https://docs.daisyclaw.ai/gateway), [Remote access](https://docs.daisyclaw.ai/gateway/remote), [Tailscale](https://docs.daisyclaw.ai/gateway/tailscale), [Web surfaces](https://docs.daisyclaw.ai/web)
- Tools + automation: [Tools](https://docs.daisyclaw.ai/tools), [Skills](https://docs.daisyclaw.ai/tools/skills), [Cron jobs](https://docs.daisyclaw.ai/automation/cron-jobs), [Webhooks](https://docs.daisyclaw.ai/automation/webhook), [Gmail Pub/Sub](https://docs.daisyclaw.ai/automation/gmail-pubsub)
- Internals: [Architecture](https://docs.daisyclaw.ai/concepts/architecture), [Agent](https://docs.daisyclaw.ai/concepts/agent), [Session model](https://docs.daisyclaw.ai/concepts/session), [Gateway protocol](https://docs.daisyclaw.ai/reference/rpc)
- Troubleshooting: [Channel troubleshooting](https://docs.daisyclaw.ai/channels/troubleshooting), [Logging](https://docs.daisyclaw.ai/logging), [Docs home](https://docs.daisyclaw.ai)

## Apps (optional)

The Gateway alone delivers a great experience. All apps are optional and add extra features.

If you plan to build/run companion apps, follow the platform runbooks below.

### macOS (DaisyClaw.app) (optional)

- Menu bar control for the Gateway and health.
- Voice Wake + push-to-talk overlay.
- WebChat + debug tools.
- Remote gateway control over SSH.

Note: signed builds required for macOS permissions to stick across rebuilds (see [macOS Permissions](https://docs.daisyclaw.ai/platforms/mac/permissions)).

### iOS node (optional)

- Pairs as a node over the Gateway WebSocket (device pairing).
- Voice trigger forwarding + Canvas surface.
- Controlled via `daisyclaw nodes …`.

Runbook: [iOS connect](https://docs.daisyclaw.ai/platforms/ios).

### Android node (optional)

- Pairs as a WS node via device pairing (`daisyclaw devices ...`).
- Exposes Connect/Chat/Voice tabs plus Canvas, Camera, Screen capture, and Android device command families.
- Runbook: [Android connect](https://docs.daisyclaw.ai/platforms/android).

## From source (development)

Use `pnpm` for source checkouts. The repository is a pnpm workspace, and bundled
plugins load from `extensions/*` during development so their package-local
dependencies and your edits are used directly. Plain `npm install` at the repo
root is not a supported source setup.

For the dev loop:

```bash
git clone https://github.com/daisyclaw/daisyclaw.git
cd daisyclaw

pnpm install

# First run only (or after resetting local DaisyClaw config/workspace)
pnpm daisyclaw setup

# Optional: prebuild Control UI before first startup
pnpm ui:build

# Dev loop (auto-reload on source/config changes)
pnpm gateway:watch
```

If you need a built `dist/` from the checkout (for Node, packaging, or release validation), run:

```bash
pnpm build
pnpm ui:build
```

`pnpm daisyclaw setup` writes the local config/workspace needed for `pnpm gateway:watch`. It is safe to re-run, but you normally only need it on first setup or after resetting local state. `pnpm gateway:watch` does not rebuild `dist/control-ui`, so rerun `pnpm ui:build` after `ui/` changes or use `pnpm ui:dev` when iterating on the Control UI. If you want this checkout to run onboarding directly, use `pnpm daisyclaw onboard --install-daemon`.

Note: `pnpm daisyclaw ...` runs TypeScript directly (via `tsx`). `pnpm build` produces `dist/` for running via Node / the packaged `daisyclaw` binary, while `pnpm gateway:watch` rebuilds the runtime on demand during the dev loop.

## Development channels

- **stable**: tagged releases (`vYYYY.M.D` or `vYYYY.M.D-<patch>`), npm dist-tag `latest`.
- **beta**: prerelease tags (`vYYYY.M.D-beta.N`), npm dist-tag `beta` (macOS app may be missing).
- **dev**: moving head of `main`, npm dist-tag `dev` (when published).

Switch channels (git + npm): `daisyclaw update --channel stable|beta|dev`.
Details: [Development channels](https://docs.daisyclaw.ai/install/development-channels).

## Agent workspace + skills

- Workspace root: `~/.daisyclaw/workspace` (configurable via `agents.defaults.workspace`).
- Injected prompt files: `AGENTS.md`, `SOUL.md`, `TOOLS.md`.
- Skills: `~/.daisyclaw/workspace/skills/<skill>/SKILL.md`.

## Configuration

Minimal `~/.daisyclaw/daisyclaw.json` (model + defaults):

```json5
{
  agent: {
    model: "<provider>/<model-id>",
  },
}
```

[Full configuration reference (all keys + examples).](https://docs.daisyclaw.ai/gateway/configuration)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=daisyclaw/daisyclaw&type=date&legend=top-left)](https://www.star-history.com/#daisyclaw/daisyclaw&type=date&legend=top-left)

## Molty

DaisyClaw was built for **Molty**, a space lobster AI assistant. 🦞
by Peter Steinberger and the community.

- [daisyclaw.ai](https://daisyclaw.ai)
- [soul.md](https://soul.md)
- [steipete.me](https://steipete.me)
- [@daisyclaw](https://x.com/daisyclaw)
