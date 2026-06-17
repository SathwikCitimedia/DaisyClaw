# @daisyclaw/pixverse-provider

Official PixVerse video generation provider plugin for DaisyClaw.

This plugin registers PixVerse as a `video_generate` provider for text-to-video and image-to-video workflows.

## Install

```bash
daisyclaw plugins install @daisyclaw/pixverse-provider
```

Restart the Gateway after installing or updating the plugin.

## Configure

Store your PixVerse API key in DaisyClaw config or expose the supported environment variable to the Gateway. Then select PixVerse as a video generation provider.

Full setup and model/provider examples:

- https://docs.daisyclaw.ai/providers/pixverse

## Package

- Plugin id: `pixverse`
- Package: `@daisyclaw/pixverse-provider`
- Minimum DaisyClaw host: `2026.5.26`
