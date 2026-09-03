---
name: camsnap
description: "Capture frames or clips from RTSP/ONVIF cameras."
homepage: https://camsnap.ai
metadata:
  {
    "daisyclaw":
      {
        "emoji": "📸",
        "requires": { "bins": ["camsnap"] },
        "install":
          [
            {
              "id": "brew",
              "kind": "brew",
              "os": ["darwin", "linux"],
              "formula": "steipete/tap/camsnap",
              "bins": ["camsnap"],
              "label": "Install camsnap (brew)",
            },
            {
              "id": "download-win-x64",
              "kind": "download",
              "os": ["win32"],
              "url": "https://github.com/steipete/camsnap/releases/download/v0.5.0/camsnap_0.5.0_windows_amd64.zip",
              "sha256": "2d9d1fd01cf6de08b86b099d0261f96237eb0798c4367567023004f9f2814cad",
              "archive": "zip",
              "extract": true,
              "targetDir": "bin",
              "bins": ["camsnap"],
              "label": "Download camsnap (Windows x64)",
            },
            {
              "id": "download-win-arm64",
              "kind": "download",
              "os": ["win32"],
              "url": "https://github.com/steipete/camsnap/releases/download/v0.5.0/camsnap_0.5.0_windows_arm64.zip",
              "sha256": "b0d9bae452e9715d57a23c7b0774ebad2e83ec6c434bef6ea48481c487a5fd05",
              "archive": "zip",
              "extract": true,
              "targetDir": "bin",
              "bins": ["camsnap"],
              "label": "Download camsnap (Windows ARM64)",
            },
          ],
      },
  }
---

# camsnap

Use `camsnap` to grab snapshots, clips, or motion events from configured cameras.

Setup

- Config file: `~/.config/camsnap/config.yaml`
- Add camera: `camsnap add --name kitchen --host 192.168.0.10 --user user --pass pass`

Common commands

- Discover: `camsnap discover --info`
- Snapshot: `camsnap snap kitchen --out shot.jpg`
- Clip: `camsnap clip kitchen --dur 5s --out clip.mp4`
- Motion watch: `camsnap watch kitchen --threshold 0.2 --action '...'`
- Doctor: `camsnap doctor --probe`

Notes

- Requires `ffmpeg` on PATH.
- Prefer a short test capture before longer clips.
