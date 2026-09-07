---
name: video-frames
description: "Extract frames or short clips from videos using ffmpeg."
homepage: https://ffmpeg.org
metadata:
  {
    "daisyclaw":
      {
        "emoji": "🎬",
        "highlights": ["Extract frames or thumbnails from videos", "Cut short clips with ffmpeg"],
        "requires": { "bins": ["ffmpeg"] },
        "install":
          [
            {
              "id": "brew",
              "kind": "brew",
              "formula": "ffmpeg",
              "bins": ["ffmpeg"],
              "label": "Install ffmpeg (brew)",
            },
            {
              "id": "download-win-x64",
              "kind": "download",
              "os": ["win32"],
              "url": "https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2026-09-02-13-13/ffmpeg-n8.1.2-50-g1a748fe2cd-win64-gpl-8.1.zip",
              "sha256": "954c2f5a219d6d34280393ceaf611777f6fcc96b785263328fb263df35dc1f8a",
              "archive": "zip",
              "extract": true,
              "bins": ["ffmpeg"],
              "label": "Download ffmpeg (Windows x64)",
            },
          ],
      },
  }
---

# Video Frames (ffmpeg)

Extract a single frame from a video, or create quick thumbnails for inspection.

## Quick start

First frame:

```bash
{baseDir}/scripts/frame.sh /path/to/video.mp4 --out /tmp/frame.jpg
```

At a timestamp:

```bash
{baseDir}/scripts/frame.sh /path/to/video.mp4 --time 00:00:10 --out /tmp/frame-10s.jpg
```

## Notes

- Prefer `--time` for "what is happening around here?".
- Use a `.jpg` for quick share; use `.png` for crisp UI frames.
