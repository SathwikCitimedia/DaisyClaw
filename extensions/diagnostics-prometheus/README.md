# @daisyclaw/diagnostics-prometheus

Official Prometheus diagnostics exporter for DaisyClaw.

This plugin exposes DaisyClaw Gateway runtime metrics in Prometheus text format for Prometheus, Grafana, VictoriaMetrics, and compatible scrapers.

## Install

```bash
daisyclaw plugins install @daisyclaw/diagnostics-prometheus
```

Restart the Gateway after installing or updating the plugin.

## Configure

Enable the plugin and set the scrape endpoint options in `plugins.entries.diagnostics-prometheus.config`.

The full config surface, metric names, and scrape examples live in the docs:

- https://docs.daisyclaw.ai/gateway/prometheus

## Package

- Plugin id: `diagnostics-prometheus`
- Package: `@daisyclaw/diagnostics-prometheus`
- Minimum DaisyClaw host: `2026.4.25`
