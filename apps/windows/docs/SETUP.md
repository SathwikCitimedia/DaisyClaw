# DaisyClaw Companion - Installation & Setup Guide

This guide covers installing DaisyClaw Companion (Molty) on Windows using the pre-built installer. For building from source, see [DEVELOPMENT.md](../DEVELOPMENT.md).

## Prerequisites

Before installing, make sure you have:

- **Windows 10 (20H2 or later)** or **Windows 11**
- **WebView2 Runtime** - pre-installed on Windows 11 and most up-to-date Windows 10 systems. If missing, download from [Microsoft Edge WebView2](https://developer.microsoft.com/microsoft-edge/webview2/).

You do **not** need a pre-existing local DaisyClaw gateway before installing. On first launch, DaisyClaw Companion can install a dedicated local WSL gateway for you, or you can use **Advanced setup** to connect to an existing local, remote, or manually configured gateway. See [Onboarding Wizard](ONBOARDING_WIZARD.md) for the install-new-WSL and connect-existing handoff flow.

New to the DaisyClaw roles? Read [Operator and node concepts](OPERATOR_NODE_CONCEPTS.md) for a short glossary of gateway, local WSL gateway, operator, node, pairing, reapproval, and allowlisted node capabilities before starting setup.

## Step-by-Step Installation

### 1. Download the Installer

Download the latest stable installer from the canonical DaisyClaw release assets:

| File | Architecture |
|------|-------------|
| [DaisyClawCompanion-Setup-x64.exe](https://github.com/daisyclaw/daisyclaw-windows/releases/latest/download/DaisyClawCompanion-Setup-x64.exe) | Intel / AMD (most PCs) |
| [DaisyClawCompanion-Setup-arm64.exe](https://github.com/daisyclaw/daisyclaw-windows/releases/latest/download/DaisyClawCompanion-Setup-arm64.exe) | ARM64 (Surface Pro X, Snapdragon laptops) |
| [DaisyClawCompanion-SHA256SUMS.txt](https://github.com/daisyclaw/daisyclaw-windows/releases/latest/download/DaisyClawCompanion-SHA256SUMS.txt) | SHA-256 checksums |

If you're unsure, use the **x64** installer.

### 2. Run the Installer

Double-click the downloaded `.exe`. Windows may show a SmartScreen prompt - click **More info → Run anyway** (this is normal for code-signed apps that haven't yet accumulated reputation).

The installer runs without requiring administrator privileges.

### 3. Choose Optional Components

The installer offers optional shortcuts and startup integration:

- **Create Desktop Icon** - adds a shortcut to your desktop.
- **Start DaisyClaw Companion when Windows starts** - launches Molty automatically at login (recommended).

### 4. First Launch

After the installer finishes, DaisyClaw Companion starts automatically. Look for the DaisyClaw icon in the system tray (bottom-right corner of the taskbar, near the clock).

If you don't see it, check the **hidden icons** area (the `^` arrow next to the tray).

The installer also creates a Start Menu group with shortcuts for **DaisyClaw Companion**, **DaisyClaw Gateway Setup**, **DaisyClaw Companion Settings**, **DaisyClaw Chat**, **Check for Updates**, and uninstall. The Gateway Setup shortcut launches the bundled local WSL/onboarding setup app.

### 5. Onboarding Wizard

On first launch, Molty opens the onboarding wizard when there is no usable saved gateway connection. The default flow installs and configures a dedicated app-owned local WSL gateway:

1. **Security notice** - Confirms this is a trusted PC before local setup starts.

2. **Welcome** - Choose **Install a local gateway (WSL)** to install the app-owned WSL gateway, or **Connect to an existing gateway** to open the tray app's Connections tab.

   For the role split behind these choices, see [Operator and node concepts](OPERATOR_NODE_CONCEPTS.md).

3. **Capabilities** - Choose a capability profile, review matching Windows permission status, and see exactly what setup will install before anything runs.

4. **Local setup progress** - Installs a fresh app-owned `DaisyClawGateway` WSL instance and connects Molty to it. This does not modify an existing user Ubuntu distro.

5. **Gateway installed** - Confirms the private gateway is running and offers **Start DaisyClaw onboard**.

6. **DaisyClaw onboard** - Gateway-driven provider/model/key setup rendered as a transcript. Recovery options stay available if the gateway wizard needs attention.

7. **All set** - A summary of available features and startup preference. Fresh setup defaults launch-at-startup on; direct DaisyClaw onboard preserves any existing startup preference.

After the wizard, the tray icon turns green when connected. You can re-run the wizard or change settings anytime from the tray menu.

## Tray Icon Status

| Icon colour | Meaning |
|-------------|---------|
| 🟢 Green | Connected to gateway |
| 🟡 Amber | Connecting / reconnecting |
| 🔴 Red | Error |
| ⚫ Grey | Disconnected |

Left-click the icon to open the quick-access menu. Right-click for context options.

## Deep Links

DaisyClaw Companion responds to `daisyclaw://` deep links, which can be invoked from a browser or another app:

| Link | Action |
|------|--------|
| `daisyclaw://dashboard` | Open the DaisyClaw web dashboard |
| `daisyclaw://dashboard/sessions` | Open the sessions dashboard page |
| `daisyclaw://dashboard/channels` | Open the channels dashboard page |
| `daisyclaw://dashboard/skills` | Open the skills dashboard page |
| `daisyclaw://dashboard/cron` | Open the cron dashboard page |
| `daisyclaw://chat` | Open the embedded Chat page |
| `daisyclaw://settings` | Open the Settings page |
| `daisyclaw://setup` | Open the Setup Wizard |
| `daisyclaw://commandcenter` | Open Command Center diagnostics |
| `daisyclaw://activity` | Legacy activity route; opens Sessions, Usage, Instances, or Channels according to `?filter=` |
| `daisyclaw://history` | Legacy notification-history alias; opens the Channels page |
| `daisyclaw://healthcheck` | Run a manual health check |
| `daisyclaw://check-updates` | Run a manual update check |
| `daisyclaw://logs` | Open the current tray log file |
| `daisyclaw://log-folder` | Open the logs folder |
| `daisyclaw://config` | Open the config folder |
| `daisyclaw://diagnostics` | Open the diagnostics JSONL folder |
| `daisyclaw://support-context` | Copy redacted support context |
| `daisyclaw://debug-bundle` | Copy a combined debug bundle for support |
| `daisyclaw://browser-setup` | Copy browser.proxy/browser-control setup guidance |
| `daisyclaw://port-diagnostics` | Copy gateway/browser/tunnel port diagnostics with owner PID stop hints |
| `daisyclaw://capability-diagnostics` | Copy permissions, allowlist, and parity diagnostics |
| `daisyclaw://node-inventory` | Copy node capabilities, commands, and policy status |
| `daisyclaw://channel-summary` | Copy channel health and start/stop availability |
| `daisyclaw://activity-summary` | Copy recent tray activity for troubleshooting |
| `daisyclaw://extensibility-summary` | Copy channel, skills, and cron dashboard surface guidance |
| `daisyclaw://restart-ssh-tunnel` | Restart the tray-managed SSH tunnel when enabled |
| `daisyclaw://agent?message=Hello` | Send a message directly to the connected gateway |

## Troubleshooting

### Tray icon doesn't appear

1. Check Task Manager for `DaisyClaw.Tray.WinUI.exe` - if it's running, the icon may be hidden.
2. Drag the icon out of the hidden overflow area to always show it.
3. If the process isn't running, try launching from Start Menu → **DaisyClaw Companion**.

### "WebView2 Runtime is missing" error

Download and install WebView2 from [Microsoft](https://developer.microsoft.com/microsoft-edge/webview2/). The **Evergreen Standalone Installer** is the easiest option.

### Can't connect to gateway

- Verify the gateway URL in Settings (default: `ws://localhost:18789`).
- Make sure the DaisyClaw gateway process is running.
- Check Windows Firewall - if your gateway runs on a different machine, allow inbound traffic on port 18789.
- See the log at `%LOCALAPPDATA%\DaisyClawTray\daisyclaw-tray.log` for connection errors.
- For easy-button setup, repair, or remove failures, start with `%LOCALAPPDATA%\DaisyClawTray\Logs\Setup\easy-setup-latest.txt`; Copilot CLI/debugging tools can use `%LOCALAPPDATA%\DaisyClawTray\Logs\Setup\easy-setup-latest.jsonl`.

### Need to inspect or edit the managed WSL gateway

Local setup creates a locked-down app-owned `DaisyClawGateway` distro rather than a general-purpose user Ubuntu profile. Edit `daisyclaw.json` from inside WSL as the `daisyclaw` user, and reserve `wsl.exe -d DaisyClawGateway --user root -- ...` for protected-file administration. See [Managing the locked-down WSL gateway](WSL_GATEWAY_ADMIN.md) for examples.

### "Not yet paired" message on reconnect

If the tray shows **Pending approval** after reconnecting, run the approval command shown in the tray or log:

```
daisyclaw devices approve <device-id>
```

See [issue #81](https://github.com/daisyclaw/daisyclaw-windows/issues/81) for context on this flow.

### Setup code doesn't work

- Make sure you paste the **entire** setup code - it's a single base64url-encoded string.
- Check for accidental leading/trailing whitespace.
- The code must be from a compatible gateway version. Try entering the gateway URL and token manually instead.
- If the easy-button setup flow generated the code, check `%LOCALAPPDATA%\DaisyClawTray\Logs\Setup\easy-setup-latest.txt` for the failing phase and next action.

### Connection test fails

- Verify the gateway URL is correct (e.g., `ws://localhost:18789` for local, or the full URL for remote).
- Check that your token is valid and hasn't expired.
- If the gateway is on another machine, ensure Windows Firewall allows traffic on the gateway port.
- See the log at `%LOCALAPPDATA%\DaisyClawTray\daisyclaw-tray.log` for detailed error messages.
- Easy-button setup diagnostics keep per-run JSONL traces at `%LOCALAPPDATA%\DaisyClawTray\Logs\Setup\setup-*.jsonl` and update `easy-setup-latest.txt`/`.jsonl` after each run.

### Wizard shows "offline"

The Wizard screen relies on the gateway's wizard protocol. If it shows offline:
- The gateway may not support wizard mode yet - this is fine, configuration can be done later.
- Check that the gateway is running and reachable.
- You can skip the Wizard screen and configure your gateway manually from the tray menu → Settings.

### Settings are not saved

Settings are stored at `%APPDATA%\DaisyClawTray\settings.json`. If this file is corrupt, delete it and reconfigure from scratch.

### Auto-start isn't working

1. Open Settings and toggle **Start with Windows** off, then on again.
2. Check `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` for a `DaisyClawTray` entry.

## Updating

DaisyClaw Companion checks for updates automatically and shows a notification when a new version is available. Click **Update** to download and apply the update. You can also manually check by re-downloading from the [DaisyClaw Windows docs](https://docs.daisyclaw.ai/platforms/windows) or the [latest DaisyClaw Windows release](https://github.com/daisyclaw/daisyclaw-windows/releases/latest).

## Uninstalling

Go to **Settings → Apps → Installed apps**, find **DaisyClaw Companion**, and click **Uninstall**. Alternatively, use **Add or Remove Programs** in the Control Panel.

Your settings file at `%APPDATA%\DaisyClawTray\settings.json` and device identity files under `%APPDATA%\DaisyClawTray\` (including per-gateway keys at `%APPDATA%\DaisyClawTray\gateways\<gateway-id>\device-key-ed25519.json`) are not removed automatically - delete them manually if you want a clean uninstall.
