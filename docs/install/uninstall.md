---
summary: "Uninstall DaisyClaw completely (CLI, service, state, workspace)"
read_when:
  - You want to remove DaisyClaw from a machine
  - The gateway service is still running after uninstall
title: "Uninstall"
---

Two paths:

- **Easy path** if `daisyclaw` is still installed.
- **Manual service removal** if the CLI is gone but the service is still running.

## Easy path (CLI still installed)

Recommended: use the built-in uninstaller:

```bash
daisyclaw uninstall
```

When using the CLI, state removal preserves configured workspace directories unless you also select `--workspace`.

Preview what will be removed (safe):

```bash
daisyclaw uninstall --dry-run --all
```

Non-interactive (automation / npx). Use with caution and only after confirming scopes:

```bash
daisyclaw uninstall --all --yes --non-interactive
npx -y daisyclaw uninstall --all --yes --non-interactive
```

Manual steps (same result):

1. Stop the gateway service:

```bash
daisyclaw gateway stop
```

2. Uninstall the gateway service (launchd/systemd/schtasks):

```bash
daisyclaw gateway uninstall
```

3. Delete state + config:

```bash
rm -rf "${DAISYCLAW_STATE_DIR:-$HOME/.daisyclaw}"
```

If you set `DAISYCLAW_CONFIG_PATH` to a custom location outside the state dir, delete that file too.
If you want to keep a workspace inside the state dir, such as `~/.daisyclaw/workspace`, move it aside before running `rm -rf` or delete state contents selectively.

4. Delete your workspace (optional, removes agent files):

```bash
rm -rf ~/.daisyclaw/workspace
```

5. Remove the CLI install (pick the one you used):

```bash
npm rm -g daisyclaw
pnpm remove -g daisyclaw
bun remove -g daisyclaw
```

6. If you installed the macOS app:

```bash
rm -rf /Applications/DaisyClaw.app
```

Notes:

- If you used profiles (`--profile` / `DAISYCLAW_PROFILE`), repeat step 3 for each state dir (defaults are `~/.daisyclaw-<profile>`).
- In remote mode, the state dir lives on the **gateway host**, so run steps 1-4 there too.

## Manual service removal (CLI not installed)

Use this if the gateway service keeps running but `daisyclaw` is missing.

### macOS (launchd)

Default label is `ai.daisyclaw.gateway` (or `ai.daisyclaw.<profile>`; legacy `com.daisyclaw.*` may still exist):

```bash
launchctl bootout gui/$UID/ai.daisyclaw.gateway
rm -f ~/Library/LaunchAgents/ai.daisyclaw.gateway.plist
```

If you used a profile, replace the label and plist name with `ai.daisyclaw.<profile>`. Remove any legacy `com.daisyclaw.*` plists if present.

### Linux (systemd user unit)

Default unit name is `daisyclaw-gateway.service` (or `daisyclaw-gateway-<profile>.service`):

```bash
systemctl --user disable --now daisyclaw-gateway.service
rm -f ~/.config/systemd/user/daisyclaw-gateway.service
systemctl --user daemon-reload
```

### Windows (Scheduled Task)

Default task name is `DaisyClaw Gateway` (or `DaisyClaw Gateway (<profile>)`).
The task script lives under your state dir.

```powershell
schtasks /Delete /F /TN "DaisyClaw Gateway"
Remove-Item -Force "$env:USERPROFILE\.daisyclaw\gateway.cmd"
```

If you used a profile, delete the matching task name and `~\.daisyclaw-<profile>\gateway.cmd`.

## Normal install vs source checkout

### Normal install (install.sh / npm / pnpm / bun)

If you used `https://daisyclaw.ai/install.sh` or `install.ps1`, the CLI was installed with `npm install -g daisyclaw@latest`.
Remove it with `npm rm -g daisyclaw` (or `pnpm remove -g` / `bun remove -g` if you installed that way).

### Source checkout (git clone)

If you run from a repo checkout (`git clone` + `daisyclaw ...` / `bun run daisyclaw ...`):

1. Uninstall the gateway service **before** deleting the repo (use the easy path above or manual service removal).
2. Delete the repo directory.
3. Remove state + workspace as shown above.

## Related

- [Install overview](/install)
- [Migration guide](/install/migrating)
