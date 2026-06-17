#!/usr/bin/env bash
set -euo pipefail

source scripts/lib/daisyclaw-e2e-instance.sh
source scripts/e2e/lib/plugins/fixtures.sh

daisyclaw_e2e_eval_test_state_from_b64 "${DAISYCLAW_TEST_STATE_SCRIPT_B64:?missing DAISYCLAW_TEST_STATE_SCRIPT_B64}"

export npm_config_loglevel=error
export npm_config_fund=false
export npm_config_audit=false
export npm_config_prefix=/tmp/npm-prefix
export NPM_CONFIG_PREFIX=/tmp/npm-prefix
export PATH="/tmp/npm-prefix/bin:$PATH"
export CI=true
export DAISYCLAW_DISABLE_BUNDLED_PLUGINS=1
export DAISYCLAW_NO_ONBOARD=1
export DAISYCLAW_NO_PROMPT=1

baseline="${DAISYCLAW_UPDATE_CORRUPT_PLUGIN_BASELINE:-daisyclaw@latest}"
update_timeout_seconds="${DAISYCLAW_UPDATE_CORRUPT_PLUGIN_TIMEOUT_SECONDS:-900}"
echo "Installing baseline DaisyClaw package: $baseline"
if ! daisyclaw_e2e_maybe_timeout "${DAISYCLAW_E2E_NPM_INSTALL_TIMEOUT:-600s}" npm install -g --prefix /tmp/npm-prefix --omit=optional "$baseline" >/tmp/daisyclaw-update-corrupt-baseline-install.log 2>&1; then
  daisyclaw_e2e_print_log /tmp/daisyclaw-update-corrupt-baseline-install.log >&2
  exit 1
fi

package_root="$(daisyclaw_e2e_package_root /tmp/npm-prefix)"
entry="$(daisyclaw_e2e_package_entrypoint "$package_root")"
export DAISYCLAW_ENTRY="$entry"

npm_pack_dir="$(mktemp -d "/tmp/daisyclaw-corrupt-plugin-pack.XXXXXX")"
npm_registry_dir="$(mktemp -d "/tmp/daisyclaw-corrupt-plugin-registry.XXXXXX")"
pack_fixture_plugin "$npm_pack_dir" /tmp/demo-corrupt-plugin.tgz demo-corrupt-plugin 0.0.1 demo.corrupt "Demo Corrupt Plugin"
start_npm_fixture_registry "@daisyclaw/demo-corrupt-plugin" "0.0.1" /tmp/demo-corrupt-plugin.tgz "$npm_registry_dir"

echo "Installing managed external plugin..."
node "$entry" plugins install "npm:@daisyclaw/demo-corrupt-plugin@0.0.1" >/tmp/daisyclaw-corrupt-plugin-install.log 2>&1
node "$entry" plugins inspect demo-corrupt-plugin --runtime --json >/tmp/daisyclaw-corrupt-plugin-before.json
unset NPM_CONFIG_REGISTRY npm_config_registry

plugin_dir="$(
  node -e '
    const fs = require("node:fs");
    const payload = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const installPath = payload.install?.installPath ?? payload.plugin?.rootDir;
    if (!installPath) {
      throw new Error("missing plugin install path in inspect output");
    }
    process.stdout.write(installPath);
  ' /tmp/daisyclaw-corrupt-plugin-before.json
)"
rm -f "$plugin_dir/package.json"
if [ -f "$plugin_dir/package.json" ]; then
  echo "Expected corrupt plugin package.json to be removed before update." >&2
  exit 1
fi

echo "Updating DaisyClaw with corrupt plugin present..."
set +e
daisyclaw_e2e_maybe_timeout "${update_timeout_seconds}s" \
  node "$entry" update \
  --channel beta \
  --tag "${DAISYCLAW_CURRENT_PACKAGE_TGZ:?missing DAISYCLAW_CURRENT_PACKAGE_TGZ}" \
  --yes \
  --no-restart \
  --json \
  >/tmp/daisyclaw-update-corrupt-plugin.json \
  2>/tmp/daisyclaw-update-corrupt-plugin.err
update_status=$?
set -e
if [ "$update_status" -ne 0 ]; then
  if ! node scripts/e2e/lib/plugin-update/probe.mjs assert-legacy-post-update-plugin-failure /tmp/daisyclaw-update-corrupt-plugin.json; then
    echo "daisyclaw update failed or timed out after ${update_timeout_seconds}s with corrupt plugin present" >&2
    daisyclaw_e2e_print_log /tmp/daisyclaw-update-corrupt-plugin.err >&2
    daisyclaw_e2e_print_log /tmp/daisyclaw-update-corrupt-plugin.json >&2
    exit "$update_status"
  fi
  echo "Legacy updater reported post-update plugin failure after installing the new core; verifying updated entrypoint..."
  set +e
  DAISYCLAW_UPDATE_POST_CORE=1 \
    DAISYCLAW_UPDATE_POST_CORE_CHANNEL=beta \
    DAISYCLAW_UPDATE_POST_CORE_RESULT_PATH=/tmp/daisyclaw-update-corrupt-plugin-post-core.json \
    daisyclaw_e2e_maybe_timeout "${update_timeout_seconds}s" \
    node "$entry" update \
    --yes \
    --no-restart \
    --json \
    >/tmp/daisyclaw-update-corrupt-plugin-post-core.stdout \
    2>/tmp/daisyclaw-update-corrupt-plugin-post-core.err
  post_core_status=$?
  set -e
  if [ "$post_core_status" -ne 0 ]; then
    echo "updated DaisyClaw entry failed or timed out after ${update_timeout_seconds}s during post-core plugin verification" >&2
    daisyclaw_e2e_print_log /tmp/daisyclaw-update-corrupt-plugin-post-core.err >&2
    daisyclaw_e2e_print_log /tmp/daisyclaw-update-corrupt-plugin-post-core.stdout >&2
    daisyclaw_e2e_print_log /tmp/daisyclaw-update-corrupt-plugin-post-core.json >&2
    exit "$post_core_status"
  fi
  node scripts/e2e/lib/plugin-update/probe.mjs assert-corrupt-plugin-result /tmp/daisyclaw-update-corrupt-plugin-post-core.json demo-corrupt-plugin
  exit 0
fi

if ! node scripts/e2e/lib/plugin-update/probe.mjs assert-corrupt-update /tmp/daisyclaw-update-corrupt-plugin.json demo-corrupt-plugin; then
  echo "corrupt update JSON payload:" >&2
  daisyclaw_e2e_print_log /tmp/daisyclaw-update-corrupt-plugin.json >&2
  echo "corrupt update stderr:" >&2
  daisyclaw_e2e_print_log /tmp/daisyclaw-update-corrupt-plugin.err >&2
  exit 1
fi
