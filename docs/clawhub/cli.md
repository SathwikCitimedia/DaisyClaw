---
summary: "ClawHub CLI entry points for discovering, installing, publishing, and verifying DaisyClaw skills and plugins."
read_when:
  - You want to use ClawHub from the command line
  - You want to install ClawHub skills or plugins through DaisyClaw
  - You want to publish ClawHub packages
title: "ClawHub CLI"
---

# ClawHub CLI

DaisyClaw has two command-line entry points for ClawHub:

- `daisyclaw skills` and `daisyclaw plugins` install and manage ClawHub packages
  inside DaisyClaw.
- The standalone `clawhub` CLI handles publisher workflows such as login,
  publish, transfer, and sync.

## Discover and install

Use DaisyClaw commands when you want to install or update packages for a local
DaisyClaw agent or Gateway.

```bash
daisyclaw skills search "calendar"
daisyclaw skills install <slug>
daisyclaw skills update <slug>
daisyclaw skills verify <slug>

daisyclaw plugins search "calendar"
daisyclaw plugins install clawhub:<package>
daisyclaw plugins update <id-or-npm-spec>
```

Skill installs target the active workspace `skills/` directory by default. Add
`--global` to install into the shared managed skills directory.

Plugin installs use the `clawhub:` prefix when you want ClawHub resolution
instead of npm or another install source.

## Publish and maintain

Install the standalone ClawHub CLI for publisher workflows:

```bash
npm i -g clawhub
clawhub login
```

Publish plugin packages with `clawhub package publish`:

```bash
clawhub package publish your-org/your-plugin --dry-run
clawhub package publish your-org/your-plugin
clawhub package publish your-org/your-plugin@v1.0.0
```

Publish skill folders with `clawhub skill publish`:

```bash
clawhub skill publish ./skills/review-helper
clawhub skill publish ./skills/review-helper --version 1.0.0
```

When local skill scan state or package ownership needs maintenance, use the
relevant standalone command:

```bash
clawhub sync --all
clawhub package transfer @old-owner/package --to new-owner
```

## Related

- [`daisyclaw skills`](/cli/skills) - local skill search, install, update, and
  verification
- [`daisyclaw plugins`](/cli/plugins) - plugin search, install, update, and
  inspection
- [ClawHub publishing](/clawhub/publishing) - owner scope, release validation,
  and review flow
- [Creating skills](/tools/creating-skills) - skill authoring and publish flow
- [Building plugins](/plugins/building-plugins) - plugin package authoring
