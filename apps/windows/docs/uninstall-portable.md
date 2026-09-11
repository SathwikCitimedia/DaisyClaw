# Uninstalling DaisyClaw Tray - Portable ZIP

> **Date:** 2026-05-07
> **Branch:** feat/wsl-gateway-uninstall

Portable (ZIP) installations have **no automatic uninstall hook**.
Simply deleting the folder leaves the WSL distro, app data, and autostart
entry behind.  Follow one of the two paths below for a clean removal.

---

## Recommended: In-Tray Removal (Requires the Tray Running)

1. Open the tray icon.
2. Navigate to **Settings → Local Gateway**.
3. Click **"Remove Local Gateway"**.
4. The engine stops keepalive processes, unregisters the WSL distro, nulls
   the device token, removes autostart, and cleans up app data.
5. After the operation completes, delete the portable folder.

---

## CLI: Headless Removal (No Tray UI Required)

Run from the portable folder:

```powershell
# Destructive - removes the local WSL gateway cleanly, then print result to stdout
.\DaisyClaw.Tray.WinUI.exe --uninstall --confirm-destructive

# With JSON output for programmatic consumption (tokens redacted in output):
.\DaisyClaw.Tray.WinUI.exe --uninstall --confirm-destructive --json-output .\uninstall-result.json

# Dry-run - records what would happen without any destruction:
.\DaisyClaw.Tray.WinUI.exe --uninstall --dry-run
```

**Exit codes:**

| Code | Meaning |
|------|---------|
| 0 | Success - all steps completed, postconditions satisfied |
| 1 | Partial failure - one or more steps failed (see JSON output or stderr) |
| 2 | Bad arguments - `--confirm-destructive` or `--dry-run` missing |

After the CLI command exits 0, delete the portable folder.

---

## WARNING: Deleting the Folder Without Running Uninstall

Deleting the portable folder **without** running the uninstall first leaves:

- **WSL distro orphaned** - `DaisyClawGateway` remains in `wsl --list`.
  Manual cleanup: `wsl --unregister DaisyClawGateway`

- **App data** remains under:
  - `%APPDATA%\DaisyClawTray\` - device key, settings, mcp-token
  - `%LOCALAPPDATA%\DaisyClawTray\` - setup state, logs, exec policy, VHD parent dir

- **Autostart entry** may remain in
  `HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run\DaisyClawTray`

Manual WSL + registry cleanup:

```powershell
wsl --unregister DaisyClawGateway
Remove-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" `
    -Name "DaisyClawTray" -ErrorAction SilentlyContinue
Remove-Item "$env:LOCALAPPDATA\DaisyClawTray\wsl\DaisyClawGateway" -Recurse -Force -ErrorAction SilentlyContinue
```
