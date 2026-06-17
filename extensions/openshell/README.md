# @daisyclaw/openshell-sandbox

Official NVIDIA OpenShell sandbox backend for DaisyClaw.

This plugin lets DaisyClaw use OpenShell-managed sandboxes with mirrored local workspaces and SSH command execution.

## Install

```bash
daisyclaw plugins install @daisyclaw/openshell-sandbox
```

Restart the Gateway after installing or updating the plugin.

## Configure

Use the OpenShell docs for credentials, workspace mirroring, runtime selection, and troubleshooting:

- https://docs.daisyclaw.ai/gateway/openshell

## Package

- Plugin id: `openshell`
- Package: `@daisyclaw/openshell-sandbox`
- Minimum DaisyClaw host: `2026.5.12-beta.1`
