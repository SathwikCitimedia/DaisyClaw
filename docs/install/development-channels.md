---
summary: "Stable, beta, and dev channels: semantics, switching, pinning, and tagging"
read_when:
  - You want to switch between stable/beta/dev
  - You want to pin a specific version, tag, or SHA
  - You are tagging or publishing prereleases
title: "Release channels"
sidebarTitle: "Release Channels"
---

DaisyClaw ships three update channels:

- **stable**: npm dist-tag `latest`. Recommended for most users.
- **beta**: npm dist-tag `beta` when it is current; if beta is missing or older than
  the latest stable release, the update flow falls back to `latest`.
- **dev**: moving head of `main` (git). npm dist-tag: `dev` (when published).
  The `main` branch is for experimentation and active development. It may contain
  incomplete features or breaking changes. Do not use it for production gateways.

We usually ship stable builds to **beta** first, test them there, then run an
explicit promotion step that moves the vetted build to `latest` without
changing the version number. Maintainers can also publish a stable release
directly to `latest` when needed. Dist-tags are the source of truth for npm
installs.

## Switching channels

```bash
daisyclaw update --channel stable
daisyclaw update --channel beta
daisyclaw update --channel dev
```

`--channel` persists your choice in config (`update.channel`) and aligns the
install method:

- **`stable`** (package installs): updates via npm dist-tag `latest`.
- **`beta`** (package installs): prefers npm dist-tag `beta`, but falls back to
  `latest` when `beta` is missing or older than the current stable tag.
- **`stable`** (git installs): checks out the latest stable git tag, excluding
  semver prerelease tags such as `-alpha.N`, `-beta.N`, `-rc.N`, `-dev.N`,
  `-next.N`, `-preview.N`, `-canary.N`, `-nightly.N`, and other prerelease
  suffixes.
- **`beta`** (git installs): prefers the latest beta git tag, but falls back to
  the latest stable git tag when beta is missing or older.
- **`dev`**: ensures a git checkout (default `~/daisyclaw`, or
  `$DAISYCLAW_HOME/daisyclaw` when `DAISYCLAW_HOME` is set; override with
  `DAISYCLAW_GIT_DIR`), switches to `main`, rebases on upstream, builds, and
  installs the global CLI from that checkout.

<Tip>
If you want stable and dev in parallel, keep two clones and point your gateway at the stable one.
</Tip>

## One-off version or tag targeting

Use `--tag` to target a specific dist-tag, version, or package spec for a single
update **without** changing your persisted channel:

```bash
# Install a specific version
daisyclaw update --tag 2026.4.1-beta.1

# Install from the beta dist-tag (one-off, does not persist)
daisyclaw update --tag beta

# Switch to the moving GitHub main checkout
daisyclaw update --channel dev

# Install a specific npm package spec
daisyclaw update --tag daisyclaw@2026.4.1-beta.1

# Install from GitHub main once without persisting the channel
daisyclaw update --tag main
```

Notes:

- `--tag` applies to **package (npm) installs only**. Git installs ignore it.
- The tag is not persisted. Your next `daisyclaw update` uses your configured
  channel as usual.
- For package installs, DaisyClaw pre-packs GitHub/git source specs into a
  temporary tarball before the staged npm install. Use `--channel dev` or
  `--install-method git --version main` when you want the moving `main`
  checkout as your persistent install.
- Downgrade protection: if the target version is older than your current version,
  DaisyClaw prompts for confirmation (skip with `--yes`).
- `--channel beta` is different from `--tag beta`: the channel flow can fall back
  to stable/latest when beta is missing or older, while `--tag beta` targets the
  raw `beta` dist-tag for that one run.

## Dry run

Preview what `daisyclaw update` would do without making changes:

```bash
daisyclaw update --dry-run
daisyclaw update --channel beta --dry-run
daisyclaw update --tag 2026.4.1-beta.1 --dry-run
daisyclaw update --dry-run --json
```

The dry run shows the effective channel, target version, planned actions, and
whether a downgrade confirmation would be required.

## Plugins and channels

When you switch channels with `daisyclaw update`, DaisyClaw also syncs plugin
sources:

- `dev` prefers bundled plugins from the git checkout.
- `stable` and `beta` restore npm-installed plugin packages.
- npm-installed plugins are updated after the core update completes.

## Checking current status

```bash
daisyclaw update status
```

Shows the active channel, install kind (git or package), current version, and
source (config, git tag, git branch, or default).

## Tagging best practices

- Tag releases you want git checkouts to land on (`vYYYY.M.PATCH` for stable,
  `vYYYY.M.PATCH-beta.N` for beta; named semver prerelease suffixes such as
  `-alpha.N`, `-rc.N`, and `-next.N` are not stable targets).
- Legacy numeric stable tags such as `vYYYY.M.PATCH-1` and `v1.0.1-1` are still
  recognized as stable git tags for compatibility.
- `vYYYY.M.PATCH.beta.N` is also recognized for compatibility, but prefer `-beta.N`.
- Keep tags immutable: never move or reuse a tag.
- npm dist-tags remain the source of truth for npm installs:
  - `latest` -> stable
  - `beta` -> candidate build or beta-first stable build
  - `dev` -> main snapshot (optional)

## macOS app availability

Beta and dev builds may **not** include a macOS app release. That is OK:

- The git tag and npm dist-tag can still be published.
- Call out "no macOS build for this beta" in release notes or changelog.

## Related

- [Updating](/install/updating)
- [Installer internals](/install/installer)
