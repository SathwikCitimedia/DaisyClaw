---
summary: "CLI reference for `daisyclaw models` (status/list/set/scan, aliases, fallbacks, auth)"
read_when:
  - You want to change default models or view provider auth status
  - You want to scan available models/providers and debug auth profiles
title: "Models"
---

# `daisyclaw models`

Model discovery, scanning, and configuration (default model, fallbacks, auth profiles).

Related:

- Providers + models: [Models](/providers/models)
- Model selection concepts + `/models` slash command: [Models concept](/concepts/models)
- Provider auth setup: [Getting started](/start/getting-started)

## Common commands

```bash
daisyclaw models status
daisyclaw models list
daisyclaw models set <model-or-alias>
daisyclaw models scan
```

`daisyclaw models status` shows the resolved default/fallbacks plus an auth overview.
When provider usage snapshots are available, the OAuth/API-key status section includes
provider usage windows and quota snapshots.
Current usage-window providers: Anthropic, GitHub Copilot, Gemini CLI, OpenAI,
MiniMax, Xiaomi, and z.ai. Usage auth comes from provider-specific hooks
when available; otherwise DaisyClaw falls back to matching OAuth/API-key
credentials from auth profiles, env, or config.
In `--json` output, `auth.providers` is the env/config/store-aware provider
overview, while `auth.oauth` is auth-store profile health only.
Add `--probe` to run live auth probes against each configured provider profile.
Probes are real requests (may consume tokens and trigger rate limits).
Use `--agent <id>` to inspect a configured agent's model/auth state. When omitted,
the command uses `DAISYCLAW_AGENT_DIR` if set, otherwise the
configured default agent.
Probe rows can come from auth profiles, env credentials, or `models.json`.
For OpenAI ChatGPT/Codex OAuth troubleshooting, `daisyclaw models status`,
`daisyclaw models auth list --provider openai`, and
`daisyclaw config get agents.defaults.model --json` are the quickest way to
confirm whether an agent has a usable `openai` OAuth profile for
`openai/*` through the native Codex runtime. See [OpenAI provider setup](/providers/openai#check-and-recover-codex-oauth-routing).

Notes:

- `models set <model-or-alias>` accepts `provider/model` or an alias.
- `models list` is read-only: it reads config, auth profiles, existing catalog
  state, and provider-owned catalog rows, but it does not rewrite
  `models.json`.
- The `Auth` column is provider-level and read-only. It is computed from local
  auth profile metadata, env markers, configured provider keys, local-provider
  markers, AWS Bedrock env/profile markers, and plugin synthetic-auth metadata;
  it does not load provider runtime, read keychain secrets, call provider
  APIs, or prove exact per-model execution readiness.
- `models list --all --provider <id>` can include provider-owned static catalog
  rows from plugin manifests or bundled provider catalog metadata even when you
  have not authenticated with that provider yet. Those rows still show as
  unavailable until matching auth is configured.
- `models list` keeps the control plane responsive while provider catalog
  discovery is slow. The default and configured views fall back to configured or
  synthetic model rows after a short wait and let discovery finish in the
  background. Use `--all` when you need the exact full discovered catalog and
  are willing to wait for provider discovery.
- Broad `models list --all` merges manifest catalog rows over registry rows
  without loading provider runtime supplement hooks. Provider-filtered manifest
  fast paths use only providers marked `static`; providers marked `refreshable`
  stay registry/cache-backed and append manifest rows as supplements, while
  providers marked `runtime` stay on registry/runtime discovery.
- `models list` keeps native model metadata and runtime caps distinct. In table
  output, `Ctx` shows `contextTokens/contextWindow` when an effective runtime
  cap differs from the native context window; JSON rows include `contextTokens`
  when a provider exposes that cap.
- `models list --provider <id>` filters by provider id, such as `moonshot` or
  `openai`. It does not accept display labels from interactive provider
  pickers, such as `Moonshot AI`.
- Model refs are parsed by splitting on the **first** `/`. If the model ID includes `/` (OpenRouter-style), include the provider prefix (example: `openrouter/moonshotai/kimi-k2`).
- If you omit the provider, DaisyClaw resolves the input as an alias first, then
  as a unique configured-provider match for that exact model id, and only then
  falls back to the configured default provider with a deprecation warning.
  If that provider no longer exposes the configured default model, DaisyClaw
  falls back to the first configured provider/model instead of surfacing a
  stale removed-provider default.
- `models status` may show `marker(<value>)` in auth output for non-secret placeholders (for example `OPENAI_API_KEY`, `secretref-managed`, `minimax-oauth`, `oauth:chutes`, `ollama-local`) instead of masking them as secrets.

### Models scan

`models scan` reads OpenRouter's public `:free` catalog and ranks candidates for
fallback use. The catalog itself is public, so metadata-only scans do not need
an OpenRouter key.

By default DaisyClaw tries to probe tool and image support with live model calls.
If no OpenRouter key is configured, the command falls back to metadata-only
output and explains that `:free` models still require `OPENROUTER_API_KEY` for
probes and inference.

Options:

- `--no-probe` (metadata only; no config/secrets lookup)
- `--min-params <b>`
- `--max-age-days <days>`
- `--provider <name>`
- `--max-candidates <n>`
- `--timeout <ms>` (catalog request and per-probe timeout)
- `--concurrency <n>`
- `--yes`
- `--no-input`
- `--set-default`
- `--set-image`
- `--json`

`--set-default` and `--set-image` require live probes; metadata-only scan
results are informational and are not applied to config.

### Models status

Options:

- `--json`
- `--plain`
- `--check` (exit 1=expired/missing, 2=expiring)
- `--probe` (live probe of configured auth profiles)
- `--probe-provider <name>` (probe one provider)
- `--probe-profile <id>` (repeat or comma-separated profile ids)
- `--probe-timeout <ms>`
- `--probe-concurrency <n>`
- `--probe-max-tokens <n>`
- `--agent <id>` (configured agent id; overrides `DAISYCLAW_AGENT_DIR`)

`--json` keeps stdout reserved for the JSON payload. Auth-profile, provider,
and startup diagnostics are routed to stderr so scripts can pipe stdout directly
into tools such as `jq`.

Probe status buckets:

- `ok`
- `auth`
- `rate_limit`
- `billing`
- `timeout`
- `format`
- `unknown`
- `no_model`

Probe detail/reason-code cases to expect:

- `excluded_by_auth_order`: a stored profile exists, but explicit
  `auth.order.<provider>` omitted it, so probe reports the exclusion instead of
  trying it.
- `missing_credential`, `invalid_expires`, `expired`, `unresolved_ref`:
  profile is present but not eligible/resolvable.
- `no_model`: provider auth exists, but DaisyClaw could not resolve a probeable
  model candidate for that provider.

## Aliases + fallbacks

```bash
daisyclaw models aliases list
daisyclaw models fallbacks list
```

## Auth profiles

```bash
daisyclaw models auth add
daisyclaw models auth list [--provider <id>] [--json]
daisyclaw models auth login --provider <id>
daisyclaw models auth login --provider openai --profile-id openai:work
daisyclaw models auth paste-api-key --provider <id>
daisyclaw models auth setup-token --provider <id>
daisyclaw models auth paste-token
```

`models auth add` is the interactive auth helper. It can launch a provider auth
flow (OAuth/API key) or guide you into manual token paste, depending on the
provider you choose.

`models auth list` lists saved auth profiles for the selected agent without
printing token, API-key, or OAuth secret material. Use `--provider <id>` to
filter to one provider, such as `openai`, and `--json` for scripting.

`models auth login` runs a provider plugin's auth flow (OAuth/API key). Use
`daisyclaw plugins list` to see which providers are installed.
Use `daisyclaw models auth --agent <id> <subcommand>` to write auth results to a
specific configured agent store. The parent `--agent` flag is honored by
`add`, `list`, `login`, `paste-api-key`, `setup-token`, `paste-token`, and
`login-github-copilot`.

For OpenAI models, `--provider openai` defaults to ChatGPT/Codex account login.
Use `--method api-key` only when you want to add an OpenAI API-key profile,
usually as a backup for Codex subscription limits. Run `daisyclaw doctor --fix`
to migrate older legacy OpenAI Codex prefix auth/profile state to `openai`.

Examples:

```bash
daisyclaw models auth login --provider openai --set-default
daisyclaw models auth login --provider openai --method api-key
daisyclaw models auth paste-api-key --provider openai
daisyclaw models auth list --provider openai
```

Notes:

- `login` accepts `--profile-id <id>` for providers that support named
  profiles during login. Use this to keep multiple logins for the same
  provider separate.
- `paste-api-key` accepts API keys generated elsewhere, prompts for the key
  value, and writes it to the default profile id `<provider>:manual` unless you
  pass `--profile-id`. In automation, pipe the key on stdin, for example
  `printf "%s\n" "$OPENAI_API_KEY" | daisyclaw models auth paste-api-key --provider openai`.
- `setup-token` and `paste-token` remain generic token commands for providers
  that expose token auth methods.
- `setup-token` requires an interactive TTY and runs the provider's token-auth
  method (defaulting to that provider's `setup-token` method when it exposes
  one).
- `paste-token` accepts a token string generated elsewhere or from automation.
- `paste-token` requires `--provider`, prompts for the token value by default,
  and writes it to the default profile id `<provider>:manual` unless you pass
  `--profile-id`.
- In automation, pipe the token on stdin instead of passing it as an argument so
  provider credentials do not appear in shell history or process lists.
- `paste-token --expires-in <duration>` stores an absolute token expiry from a
  relative duration such as `365d` or `12h`.
- For `openai`, OpenAI API keys and ChatGPT/OAuth token material are
  different auth shapes. Use `paste-api-key` for `sk-...` OpenAI API keys and
  `paste-token` only for token auth material.
- Anthropic note: Anthropic staff told us DaisyClaw-style Claude CLI usage is allowed again, so DaisyClaw treats Claude CLI reuse and `claude -p` usage as sanctioned for this integration unless Anthropic publishes a new policy.
- Anthropic `setup-token` / `paste-token` remain available as a supported DaisyClaw token path, but DaisyClaw now prefers Claude CLI reuse and `claude -p` when available.

## Related

- [CLI reference](/cli)
- [Model selection](/concepts/model-providers)
- [Model failover](/concepts/model-failover)
