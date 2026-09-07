---
name: blucli
description: "BluOS CLI (blu) for discovery, playback, grouping, and volume."
homepage: https://blucli.sh
metadata:
  {
    "daisyclaw":
      {
        "emoji": "🫐",
        "highlights":
          ["Control Bluesound and NAD speakers", "Play, pause, group rooms, and set volume"],
        "requires": { "bins": ["blu"] },
        "install":
          [
            {
              "id": "go",
              "kind": "go",
              "os": ["darwin", "linux"],
              "module": "github.com/steipete/blucli/cmd/blu@latest",
              "bins": ["blu"],
              "label": "Install blucli (go)",
            },
            {
              "id": "download-win-x64",
              "kind": "download",
              "os": ["win32"],
              "url": "https://github.com/steipete/blucli/releases/download/v0.1.5/blucli_0.1.5_windows_amd64.zip",
              "sha256": "7bc840bcb13eabf1b3bfe2441a0c648895922919d001fccdacce58b41b1db99b",
              "archive": "zip",
              "extract": true,
              "targetDir": "bin",
              "bins": ["blu"],
              "label": "Download blucli (Windows x64)",
            },
            {
              "id": "download-win-arm64",
              "kind": "download",
              "os": ["win32"],
              "url": "https://github.com/steipete/blucli/releases/download/v0.1.5/blucli_0.1.5_windows_arm64.zip",
              "sha256": "78b1b7b92dce9ee9790e99ea6113fd97844e2707744743f478c510b3d913791b",
              "archive": "zip",
              "extract": true,
              "targetDir": "bin",
              "bins": ["blu"],
              "label": "Download blucli (Windows ARM64)",
            },
          ],
      },
  }
---

# blucli (blu)

Use `blu` to control Bluesound/NAD players.

Quick start

- `blu devices` (pick target)
- `blu --device <id> status`
- `blu play|pause|stop`
- `blu volume set 15`

Target selection (in priority order)

- `--device <id|name|alias>`
- `BLU_DEVICE`
- config default (if set)

Common tasks

- Grouping: `blu group status|add|remove`
- TuneIn search/play: `blu tunein search "query"`, `blu tunein play "query"`

Prefer `--json` for scripts. Confirm the target device before changing playback.
