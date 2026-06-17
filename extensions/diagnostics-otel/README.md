# @daisyclaw/diagnostics-otel

Official OpenTelemetry diagnostics exporter for DaisyClaw.

This plugin exports DaisyClaw Gateway traces, metrics, and logs to an OTLP collector for observability stacks such as Grafana, Datadog, Honeycomb, New Relic, Tempo, and compatible collectors.

## Install

```bash
daisyclaw plugins install @daisyclaw/diagnostics-otel
```

Restart the Gateway after installing or updating the plugin.

## Configure

Enable the plugin and set the OTLP endpoint in `plugins.entries.diagnostics-otel.config`.

The full config surface, metric names, span names, and collector examples live in the docs:

- https://docs.daisyclaw.ai/gateway/opentelemetry

## Package

- Plugin id: `diagnostics-otel`
- Package: `@daisyclaw/diagnostics-otel`
- Minimum DaisyClaw host: `2026.4.25`
