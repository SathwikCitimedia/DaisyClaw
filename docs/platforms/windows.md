---
summary: "Windows support: Windows Hub, native CLI and Gateway, WSL2 gateway setup, node mode, and troubleshooting"
read_when:
  - Installing DaisyClaw on Windows
  - Choosing between Windows Hub, native Windows, and WSL2
  - Setting up the Windows companion app or Windows node mode
title: "Windows"
---

DaisyClaw ships a native **Windows Hub** companion app plus Windows CLI support.
Use Windows Hub when you want a desktop app with setup, tray status, chat,
Command Center diagnostics, and Windows node capabilities. Use the PowerShell
installer when you want the CLI/Gateway directly. Use WSL2 when you want the
most Linux-compatible Gateway runtime.

## Recommended: Windows Hub

Windows Hub is the native WinUI companion app for Windows 10 20H2+ and Windows 11. It installs without administrator privileges and is published with signed
x64 and ARM64 installers on DaisyClaw releases.

Download the latest stable installer:

- [DaisyClawCompanion-Setup-x64.exe](https://github.com/daisyclaw/daisyclaw/releases/latest/download/DaisyClawCompanion-Setup-x64.exe)
- [DaisyClawCompanion-Setup-arm64.exe](https://github.com/daisyclaw/daisyclaw/releases/latest/download/DaisyClawCompanion-Setup-arm64.exe)
- [Checksums](https://github.com/daisyclaw/daisyclaw/releases/latest/download/DaisyClawCompanion-SHA256SUMS.txt)

After install, launch **DaisyClaw Companion** from the Start menu or the system
tray. The installer also adds shortcuts for Gateway Setup, Chat, Settings,
Check for Updates, and uninstall.

### What Windows Hub includes

- system tray status and launch-at-login
- first-run setup for a local app-owned WSL Gateway
- connection settings for local, remote, and SSH-tunneled Gateways
- native chat window plus access to the browser Control UI
- Command Center diagnostics for sessions, usage, channels, nodes, pairing, and
  repair commands
- Windows node mode for agent-controlled canvas, screen, camera, notifications,
  device status, text-to-speech, speech-to-text, and controlled `system.run`
- local MCP server mode for MCP clients such as Claude Desktop, Claude Code, and
  Cursor

### First launch

On first launch, Windows Hub opens setup when there is no usable saved Gateway.
The fastest path is **Set up locally**, which provisions an app-owned
`DaisyClawGateway` WSL distro, installs the Gateway inside it, and pairs the app.
This does not export or mutate your existing Ubuntu distro.

Choose **Advanced setup** or open the Connections tab when you already have a
Gateway. You can connect to:

- a local Gateway on this PC
- a WSL Gateway on this PC
- a remote Gateway by URL and token or setup code
- a Gateway reached through an SSH tunnel

When setup finishes, the tray icon turns green. Open **Command Center** from the
tray to confirm connection, pairing, node status, and channel health.

## Windows node mode

Windows Hub can register as a first-class DaisyClaw node. The agent can then use
declared Windows-native capabilities through the Gateway.

Common commands include:

- `canvas.present`, `canvas.hide`, `canvas.navigate`, `canvas.eval`,
  `canvas.snapshot`
- `screen.snapshot` and, with explicit opt-in, `screen.record`
- `camera.list` and, with explicit opt-in, `camera.snap`, `camera.clip`
- `system.notify`, `system.run`, `system.run.prepare`, `system.which`
- `location.get`, `device.info`, `device.status`
- `stt.transcribe`, `tts.speak`

Node mode requires Gateway pairing. If the app shows a pairing request, approve
it from the Gateway host:

```powershell
daisyclaw devices list
daisyclaw devices approve <request-id>
daisyclaw nodes status
```

The Gateway only forwards commands that the node declares and server policy
allows. Privacy-sensitive commands such as `screen.record`, `camera.snap`, and
`camera.clip` require explicit `gateway.nodes.allowCommands` opt-in.

## Local MCP mode

Windows Hub can expose the same Windows-native capability registry as a local
MCP server on loopback. This is useful when you want local MCP clients to drive
Windows capabilities without a running DaisyClaw Gateway.

Enable it in Windows Hub Settings under the developer/advanced section. The app
shows the loopback endpoint and bearer token after the server is enabled.

Mode matrix:

| Node mode | MCP server | Behavior                           |
| --------- | ---------- | ---------------------------------- |
| off       | off        | Operator-only desktop app          |
| on        | off        | Gateway-connected Windows node     |
| off       | on         | Local MCP server only              |
| on        | on         | Gateway node plus local MCP server |

## Native Windows CLI and Gateway

For terminal-first use, install DaisyClaw from PowerShell:

```powershell
iwr -useb https://daisyclaw.ai/install.ps1 | iex
```

Verify:

```powershell
daisyclaw --version
daisyclaw doctor
daisyclaw gateway status --json
```

Native Windows CLI and Gateway flows are supported and continue to improve.
Managed startup uses Windows Scheduled Tasks when available and falls back to a
per-user Startup-folder login item if task creation is denied.

To install the Gateway service:

```powershell
daisyclaw gateway install
daisyclaw gateway status --json
```

If you only want CLI use without a managed Gateway service:

```powershell
daisyclaw onboard --non-interactive --skip-health
daisyclaw gateway run
```

## WSL2 Gateway

WSL2 remains the most Linux-compatible Gateway runtime on Windows. Windows Hub
can set up an app-owned WSL Gateway for you, or you can install manually inside
your own distro.

Manual setup:

```powershell
wsl --install
# Or pick a distro explicitly:
wsl --list --online
wsl --install -d Ubuntu-24.04
```

Enable systemd inside WSL:

```bash
sudo tee /etc/wsl.conf >/dev/null <<'EOF'
[boot]
systemd=true
EOF
```

Restart WSL from PowerShell:

```powershell
wsl --shutdown
```

Then install DaisyClaw inside WSL with the Linux quickstart:

```bash
curl -fsSL https://daisyclaw.ai/install.sh | bash
daisyclaw gateway status
```

## Gateway auto-start before Windows login

For headless WSL setups, ensure the full boot chain runs even when no one logs
into Windows.

Inside WSL:

```bash
sudo loginctl enable-linger "$(whoami)"
daisyclaw gateway install
```

In PowerShell as Administrator:

```powershell
schtasks /create /tn "WSL Boot" /tr "wsl.exe -d Ubuntu --exec /bin/true" /sc onstart /ru SYSTEM
```

Replace `Ubuntu` with your distro name from:

```powershell
wsl --list --verbose
```

After reboot, verify from WSL:

```bash
systemctl --user is-enabled daisyclaw-gateway.service
systemctl --user status daisyclaw-gateway.service --no-pager
```

## Expose WSL services over LAN

WSL has its own virtual network. If another machine must reach a service inside
WSL, forward a Windows port to the current WSL IP. The WSL IP can change after
restarts, so refresh the forwarding rule when needed.

Example in PowerShell as Administrator:

```powershell
$Distro = "Ubuntu-24.04"
$ListenPort = 2222
$TargetPort = 22

$WslIp = (wsl -d $Distro -- hostname -I).Trim().Split(" ")[0]
if (-not $WslIp) { throw "WSL IP not found." }

netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=$ListenPort `
  connectaddress=$WslIp connectport=$TargetPort

New-NetFirewallRule -DisplayName "WSL SSH $ListenPort" -Direction Inbound `
  -Protocol TCP -LocalPort $ListenPort -Action Allow
```

Notes:

- SSH from another machine targets the Windows host IP, for example
  `ssh user@windows-host -p 2222`.
- Remote nodes must point at a reachable Gateway URL, not `127.0.0.1`.
- Use `listenaddress=0.0.0.0` for LAN access. Use `127.0.0.1` for local-only
  access.

## Troubleshooting

### The tray icon does not appear

Check Task Manager for `DaisyClaw.Tray.WinUI.exe`. If it is running, open the
hidden tray-icons area and pin it. If it is not running, launch **DaisyClaw
Companion** from the Start menu.

### Local setup fails

Open the setup log from Windows Hub or inspect:

```powershell
notepad "$env:LOCALAPPDATA\DaisyClawTray\Logs\Setup\easy-setup-latest.txt"
```

Common causes are disabled WSL, blocked virtualization, stale app-owned WSL
state, or a network failure while installing the Gateway package.

### The app says pairing is required

Approve the operator or node request from the Gateway:

```powershell
daisyclaw devices list
daisyclaw devices approve <request-id>
```

If the device already had a token, reconnect from the Connections tab after
approval.

### Web chat cannot reach a remote Gateway

Remote web chat needs HTTPS or localhost. For self-signed certificates, trust
the certificate in Windows, or use an SSH tunnel to a localhost URL.

### `screen.snapshot`, camera, or audio commands fail

Confirm Windows permissions for camera, microphone, screen capture, and
notifications. Packaged installs declare the protected capabilities, but Windows
may still prompt the first time a command uses them.

### Git or GitHub connectivity fails

Some networks block or throttle HTTPS to GitHub. If `git clone` or `gh auth
login` fails, try another network, a VPN, or an HTTP/HTTPS proxy.

For token-based `gh` auth in the current session:

```powershell
$env:GH_TOKEN="<your-token>"
gh auth status
gh auth setup-git
```

Never commit tokens or paste them into issues or pull requests.

## Related

- [Install overview](/install)
- [Node.js setup](/install/node)
- [Nodes](/nodes)
- [Control UI](/web/control-ui)
- [Gateway configuration](/gateway/configuration)
