---
summary: "DaisyClaw Anthropic Vertex provider plugin for Claude models on Google Vertex AI."
read_when:
  - You are installing, configuring, or auditing the anthropic-vertex plugin
title: "Anthropic Vertex plugin"
---

# Anthropic Vertex plugin

DaisyClaw Anthropic Vertex provider plugin for Claude models on Google Vertex AI.

## Distribution

- Package: `@daisyclaw/anthropic-vertex-provider`
- Install route: npm; ClawHub

## Surface

providers: anthropic-vertex

<!-- daisyclaw-plugin-reference:manual-start -->

## Claude Fable 5

Use `anthropic-vertex/claude-fable-5` where the model is available in your Google Cloud region.
Fable 5 always uses adaptive thinking and defaults to `high` effort. `/think off` and
`/think minimal` use `low` effort because the model does not support disabling thinking.

<!-- daisyclaw-plugin-reference:manual-end -->
