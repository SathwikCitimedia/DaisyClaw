---
name: spotify-player
description: "Terminal Spotify playback/search via spogo (preferred) or spotify_player."
homepage: https://www.spotify.com
metadata:
  {
    "daisyclaw":
      {
        "emoji": "🎵",
        "highlights":
          [
            "Search songs, albums, and playlists",
            "Play, pause, and skip on your devices",
            "Tell you what's playing right now",
          ],
        "requires": { "anyBins": ["spogo", "spotify_player"] },
        "install":
          [
            {
              "id": "brew",
              "kind": "brew",
              "os": ["darwin", "linux"],
              "formula": "spogo",
              "tap": "steipete/tap",
              "bins": ["spogo"],
              "label": "Install spogo (brew)",
            },
            {
              "id": "brew",
              "kind": "brew",
              "os": ["darwin", "linux"],
              "formula": "spotify_player",
              "bins": ["spotify_player"],
              "label": "Install spotify_player (brew)",
            },
            {
              "id": "download-win-x64",
              "kind": "download",
              "os": ["win32"],
              "url": "https://github.com/aome510/spotify-player/releases/download/v0.24.1/spotify_player-x86_64-pc-windows-msvc.zip",
              "sha256": "e4b37883b8c6195bf525ed43db9f9916e729f56741aa9cc65e0fe1abd27c2d0d",
              "archive": "zip",
              "extract": true,
              "targetDir": "bin",
              "bins": ["spotify_player"],
              "label": "Download spotify_player (Windows x64)",
            },
          ],
      },
  }
---

# spogo / spotify_player

Use `spogo` **(preferred)** for Spotify playback/search. Fall back to `spotify_player` if needed.

Requirements

- Spotify Premium account.
- Either `spogo` or `spotify_player` installed (on Windows only `spotify_player` is available).

spotify_player sign-in

- Settings → Connections → Spotify signs the user in (it runs `spotify_player authenticate`, which opens Spotify's login page in their browser; Spotify may ask to approve twice).
- Check: `~/.cache/spotify-player/user_client_token.json` exists once signed in.

spogo setup

- Import cookies: `spogo auth import --browser chrome`

Common CLI commands

- Search: `spogo search track "query"`
- Playback: `spogo play|pause|next|prev`
- Devices: `spogo device list`, `spogo device set "<name|id>"`
- Status: `spogo status`

spotify_player commands (fallback)

- Search: `spotify_player search "query"`
- Playback: `spotify_player playback play|pause|next|previous`
- Connect device: `spotify_player connect`
- Like track: `spotify_player like`

Notes

- Config folder: `~/.config/spotify-player` (e.g., `app.toml`).
- For Spotify Connect integration, set a user `client_id` in config.
- TUI shortcuts are available via `?` in the app.
