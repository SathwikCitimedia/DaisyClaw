#!/usr/bin/env bash
# Installs the packed DaisyClaw tarball over dirty old-user state. When
# DAISYCLAW_UPGRADE_SURVIVOR_BASELINE_SPEC is set, installs that published
# baseline first and upgrades it to the selected candidate.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/lib/docker-e2e-image.sh"
source "$ROOT_DIR/scripts/lib/docker-e2e-package.sh"

IMAGE_NAME="$(docker_e2e_resolve_image "daisyclaw-upgrade-survivor-e2e" DAISYCLAW_UPGRADE_SURVIVOR_E2E_IMAGE)"
SKIP_BUILD="${DAISYCLAW_UPGRADE_SURVIVOR_E2E_SKIP_BUILD:-0}"
DOCKER_RUN_TIMEOUT="${DAISYCLAW_UPGRADE_SURVIVOR_DOCKER_RUN_TIMEOUT:-1200s}"
BASELINE_SPEC="${DAISYCLAW_UPGRADE_SURVIVOR_BASELINE_SPEC:-}"
SCENARIO="${DAISYCLAW_UPGRADE_SURVIVOR_SCENARIO:-base}"
UPDATE_RESTART_MODE="${DAISYCLAW_UPGRADE_SURVIVOR_UPDATE_RESTART_MODE:-manual}"
COMMAND_TIMEOUT="${DAISYCLAW_UPGRADE_SURVIVOR_COMMAND_TIMEOUT:-900s}"
LANE_ARTIFACT_SUFFIX="${DAISYCLAW_DOCKER_ALL_LANE_NAME:-default}"
LANE_ARTIFACT_SUFFIX="${LANE_ARTIFACT_SUFFIX//[^A-Za-z0-9_.-]/_}"
ARTIFACT_DIR="${DAISYCLAW_UPGRADE_SURVIVOR_ARTIFACT_DIR:-$ROOT_DIR/.artifacts/upgrade-survivor/$LANE_ARTIFACT_SUFFIX}"
ROOT_MANAGED_VPS="${DAISYCLAW_UPGRADE_SURVIVOR_ROOT_MANAGED_VPS:-0}"
DOCKER_RUN_USER_ARGS=()
cleanup_outer() {
  docker_e2e_cleanup_package_tgz "${PACKAGE_TGZ:-}"
}
trap cleanup_outer EXIT

if [ "$ROOT_MANAGED_VPS" = "1" ]; then
  if [ "${DAISYCLAW_UPGRADE_SURVIVOR_PUBLISHED_BASELINE:-0}" != "1" ]; then
    echo "DAISYCLAW_UPGRADE_SURVIVOR_ROOT_MANAGED_VPS=1 requires DAISYCLAW_UPGRADE_SURVIVOR_PUBLISHED_BASELINE=1" >&2
    exit 1
  fi
  DOCKER_RUN_USER_ARGS+=(--user root -e HOME=/root -e USER=root)
fi

normalize_npm_candidate() {
  local raw="$1"
  case "$raw" in
    latest | beta)
      printf 'daisyclaw@%s\n' "$raw"
      ;;
    daisyclaw@*)
      printf '%s\n' "$raw"
      ;;
    *@*)
      echo "DAISYCLAW_UPGRADE_SURVIVOR_CANDIDATE must be current, latest, beta, daisyclaw@<version>, a bare version, or a .tgz path." >&2
      return 1
      ;;
    *)
      printf 'daisyclaw@%s\n' "$raw"
      ;;
  esac
}

if [ "${DAISYCLAW_UPGRADE_SURVIVOR_PUBLISHED_BASELINE:-0}" = "1" ]; then
  if [ -z "${BASELINE_SPEC// }" ]; then
    echo "DAISYCLAW_UPGRADE_SURVIVOR_BASELINE_SPEC is required for published upgrade survivor" >&2
    exit 1
  fi

  mkdir -p "$ARTIFACT_DIR"
  chmod -R a+rwX "$ARTIFACT_DIR" || true

  DOCKER_E2E_PACKAGE_ARGS=()
  CANDIDATE_RAW="${DAISYCLAW_UPGRADE_SURVIVOR_CANDIDATE:-current}"
  CANDIDATE_KIND="npm"
  CANDIDATE_SPEC=""

  if [ -n "${DAISYCLAW_CURRENT_PACKAGE_TGZ:-}" ]; then
    PACKAGE_TGZ="$(docker_e2e_prepare_package_tgz upgrade-survivor "$DAISYCLAW_CURRENT_PACKAGE_TGZ")"
    docker_e2e_package_mount_args "$PACKAGE_TGZ"
    CANDIDATE_KIND="tarball"
    CANDIDATE_SPEC="/tmp/daisyclaw-current.tgz"
  elif [ "$CANDIDATE_RAW" = "current" ]; then
    PACKAGE_TGZ="$(docker_e2e_prepare_package_tgz upgrade-survivor)"
    docker_e2e_package_mount_args "$PACKAGE_TGZ"
    CANDIDATE_KIND="tarball"
    CANDIDATE_SPEC="/tmp/daisyclaw-current.tgz"
  elif [[ "$CANDIDATE_RAW" == *.tgz ]]; then
    if [ ! -f "$CANDIDATE_RAW" ]; then
      echo "DaisyClaw candidate tarball does not exist: $CANDIDATE_RAW" >&2
      exit 1
    fi
    PACKAGE_TGZ="$(docker_e2e_prepare_package_tgz upgrade-survivor "$CANDIDATE_RAW")"
    docker_e2e_package_mount_args "$PACKAGE_TGZ"
    CANDIDATE_KIND="tarball"
    CANDIDATE_SPEC="/tmp/daisyclaw-current.tgz"
  else
    CANDIDATE_KIND="npm"
    CANDIDATE_SPEC="$(normalize_npm_candidate "$CANDIDATE_RAW")"
  fi

  DAISYCLAW_TEST_STATE_FUNCTION_B64="$(docker_e2e_test_state_function_b64)"

  docker_e2e_build_or_reuse "$IMAGE_NAME" upgrade-survivor "$ROOT_DIR/scripts/e2e/Dockerfile" "$ROOT_DIR" "bare" "$SKIP_BUILD"

  echo "Running published upgrade survivor Docker E2E..."
  docker_e2e_run_with_harness \
    -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    -e DAISYCLAW_TEST_STATE_FUNCTION_B64="$DAISYCLAW_TEST_STATE_FUNCTION_B64" \
    -e DAISYCLAW_UPGRADE_SURVIVOR_BASELINE="$BASELINE_SPEC" \
    -e DAISYCLAW_UPGRADE_SURVIVOR_CANDIDATE_KIND="$CANDIDATE_KIND" \
    -e DAISYCLAW_UPGRADE_SURVIVOR_CANDIDATE_SPEC="$CANDIDATE_SPEC" \
    -e DAISYCLAW_UPGRADE_SURVIVOR_SCENARIO="$SCENARIO" \
    -e DAISYCLAW_UPGRADE_SURVIVOR_UPDATE_RESTART_MODE="$UPDATE_RESTART_MODE" \
    -e DAISYCLAW_UPGRADE_SURVIVOR_COMMAND_TIMEOUT="$COMMAND_TIMEOUT" \
    -e DAISYCLAW_UPGRADE_SURVIVOR_LEGACY_RUNTIME_DEPS_SYMLINK="${DAISYCLAW_UPGRADE_SURVIVOR_LEGACY_RUNTIME_DEPS_SYMLINK:-}" \
    -e DAISYCLAW_UPGRADE_SURVIVOR_ROOT_MANAGED_VPS="$ROOT_MANAGED_VPS" \
    -e DAISYCLAW_UPGRADE_SURVIVOR_SUMMARY_JSON=/tmp/daisyclaw-upgrade-survivor-artifacts/summary.json \
    -e DAISYCLAW_UPGRADE_SURVIVOR_START_BUDGET_SECONDS="${DAISYCLAW_UPGRADE_SURVIVOR_START_BUDGET_SECONDS:-90}" \
    -e DAISYCLAW_UPGRADE_SURVIVOR_STATUS_BUDGET_SECONDS="${DAISYCLAW_UPGRADE_SURVIVOR_STATUS_BUDGET_SECONDS:-30}" \
    -v "$ARTIFACT_DIR:/tmp/daisyclaw-upgrade-survivor-artifacts" \
    "${DOCKER_E2E_PACKAGE_ARGS[@]}" \
    "${DOCKER_RUN_USER_ARGS[@]}" \
    "$IMAGE_NAME" \
    timeout --kill-after=30s "$DOCKER_RUN_TIMEOUT" bash scripts/e2e/lib/upgrade-survivor/run.sh
  exit 0
fi

PACKAGE_TGZ="$(docker_e2e_prepare_package_tgz upgrade-survivor "${DAISYCLAW_CURRENT_PACKAGE_TGZ:-}")"
docker_e2e_package_mount_args "$PACKAGE_TGZ"
DAISYCLAW_TEST_STATE_SCRIPT_B64="$(docker_e2e_test_state_shell_b64 upgrade-survivor upgrade-survivor)"
mkdir -p "$ARTIFACT_DIR"
chmod -R a+rwX "$ARTIFACT_DIR" || true

docker_e2e_build_or_reuse "$IMAGE_NAME" upgrade-survivor "$ROOT_DIR/scripts/e2e/Dockerfile" "$ROOT_DIR" "bare" "$SKIP_BUILD"

echo "Running upgrade survivor Docker E2E..."
docker_e2e_run_with_harness \
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
  -e DAISYCLAW_TEST_STATE_SCRIPT_B64="$DAISYCLAW_TEST_STATE_SCRIPT_B64" \
  -e DAISYCLAW_UPGRADE_SURVIVOR_ARTIFACT_ROOT=/tmp/daisyclaw-upgrade-survivor-artifacts \
  -e DAISYCLAW_UPGRADE_SURVIVOR_ROOT_MANAGED_VPS="$ROOT_MANAGED_VPS" \
  -e DAISYCLAW_UPGRADE_SURVIVOR_SCENARIO="$SCENARIO" \
  -e DAISYCLAW_UPGRADE_SURVIVOR_UPDATE_RESTART_MODE="$UPDATE_RESTART_MODE" \
  -e DAISYCLAW_UPGRADE_SURVIVOR_COMMAND_TIMEOUT="$COMMAND_TIMEOUT" \
  -e DAISYCLAW_UPGRADE_SURVIVOR_START_BUDGET_SECONDS="${DAISYCLAW_UPGRADE_SURVIVOR_START_BUDGET_SECONDS:-90}" \
  -e DAISYCLAW_UPGRADE_SURVIVOR_STATUS_BUDGET_SECONDS="${DAISYCLAW_UPGRADE_SURVIVOR_STATUS_BUDGET_SECONDS:-30}" \
  -v "$ARTIFACT_DIR:/tmp/daisyclaw-upgrade-survivor-artifacts" \
  "${DOCKER_E2E_PACKAGE_ARGS[@]}" \
  "${DOCKER_RUN_USER_ARGS[@]}" \
  "$IMAGE_NAME" \
  timeout --kill-after=30s "$DOCKER_RUN_TIMEOUT" bash -lc 'set -euo pipefail
source scripts/lib/daisyclaw-e2e-instance.sh

export npm_config_loglevel=error
export npm_config_fund=false
export npm_config_audit=false
export DAISYCLAW_UPGRADE_SURVIVOR_ARTIFACT_ROOT="${DAISYCLAW_UPGRADE_SURVIVOR_ARTIFACT_ROOT:-/tmp/daisyclaw-upgrade-survivor-artifacts}"
export DAISYCLAW_UPGRADE_SURVIVOR_RUNTIME_ROOT="${DAISYCLAW_UPGRADE_SURVIVOR_RUNTIME_ROOT:-/tmp/daisyclaw-upgrade-survivor-runtime}"
mkdir -p "$DAISYCLAW_UPGRADE_SURVIVOR_ARTIFACT_ROOT"
export TMPDIR="${DAISYCLAW_UPGRADE_SURVIVOR_TMPDIR:-$DAISYCLAW_UPGRADE_SURVIVOR_RUNTIME_ROOT/tmp}"
export DAISYCLAW_TEST_STATE_TMPDIR="${DAISYCLAW_UPGRADE_SURVIVOR_TEST_STATE_TMPDIR:-$DAISYCLAW_UPGRADE_SURVIVOR_RUNTIME_ROOT/state-tmp}"
export npm_config_prefix="$DAISYCLAW_UPGRADE_SURVIVOR_ARTIFACT_ROOT/npm-prefix"
export NPM_CONFIG_PREFIX="$npm_config_prefix"
export npm_config_cache="${DAISYCLAW_UPGRADE_SURVIVOR_NPM_CACHE:-$DAISYCLAW_UPGRADE_SURVIVOR_RUNTIME_ROOT/npm-cache}"
export NPM_CONFIG_CACHE="$npm_config_cache"
export npm_config_tmp="$TMPDIR"
mkdir -p "$DAISYCLAW_UPGRADE_SURVIVOR_RUNTIME_ROOT" "$TMPDIR" "$DAISYCLAW_TEST_STATE_TMPDIR" "$npm_config_prefix" "$npm_config_cache"
chmod 700 "$npm_config_cache" || true
export PATH="$npm_config_prefix/bin:$PATH"
export CI=true
export DAISYCLAW_NO_ONBOARD=1
export DAISYCLAW_NO_PROMPT=1
export DAISYCLAW_SKIP_PROVIDERS=1
export DAISYCLAW_SKIP_CHANNELS=1
export DAISYCLAW_DISABLE_BONJOUR=1
export GATEWAY_AUTH_TOKEN_REF="upgrade-survivor-token"
export OPENAI_API_KEY="sk-daisyclaw-upgrade-survivor"
export DISCORD_BOT_TOKEN="upgrade-survivor-discord-token"
export TELEGRAM_BOT_TOKEN="123456:upgrade-survivor-telegram-token"
export FEISHU_APP_SECRET="upgrade-survivor-feishu-secret"
export BRAVE_API_KEY="BSA_upgrade_survivor_brave_key"

UPDATE_RESTART_MODE="${DAISYCLAW_UPGRADE_SURVIVOR_UPDATE_RESTART_MODE:-manual}"
command_timeout="${DAISYCLAW_UPGRADE_SURVIVOR_COMMAND_TIMEOUT:-900s}"
PORT=18789
START_BUDGET="${DAISYCLAW_UPGRADE_SURVIVOR_START_BUDGET_SECONDS:-90}"
STATUS_BUDGET="${DAISYCLAW_UPGRADE_SURVIVOR_STATUS_BUDGET_SECONDS:-30}"
GATEWAY_LOG="$DAISYCLAW_UPGRADE_SURVIVOR_ARTIFACT_ROOT/gateway.log"
SYSTEMCTL_SHIM_LOG="$DAISYCLAW_UPGRADE_SURVIVOR_ARTIFACT_ROOT/systemctl-shim.log"
SYSTEMCTL_SHIM_PID_FILE="$DAISYCLAW_UPGRADE_SURVIVOR_ARTIFACT_ROOT/systemctl-shim.pid"
SYSTEMCTL_SHIM_DAEMON_LOG="$DAISYCLAW_UPGRADE_SURVIVOR_ARTIFACT_ROOT/systemctl-shim-gateway.log"
BASELINE_SERVICE_INSTALL_JSON="$DAISYCLAW_UPGRADE_SURVIVOR_ARTIFACT_ROOT/baseline-service-install.json"
BASELINE_SERVICE_INSTALL_ERR="$DAISYCLAW_UPGRADE_SURVIVOR_ARTIFACT_ROOT/baseline-service-install.err"
export DAISYCLAW_UPGRADE_SURVIVOR_SYSTEMCTL_SHIM_LOG="$SYSTEMCTL_SHIM_LOG"
export DAISYCLAW_UPGRADE_SURVIVOR_SYSTEMCTL_SHIM_PID_FILE="$SYSTEMCTL_SHIM_PID_FILE"
export DAISYCLAW_UPGRADE_SURVIVOR_SYSTEMCTL_SHIM_DAEMON_LOG="$SYSTEMCTL_SHIM_DAEMON_LOG"
export DAISYCLAW_UPGRADE_SURVIVOR_BASELINE_SERVICE_INSTALL_JSON="$BASELINE_SERVICE_INSTALL_JSON"
export DAISYCLAW_UPGRADE_SURVIVOR_BASELINE_SERVICE_INSTALL_ERR="$BASELINE_SERVICE_INSTALL_ERR"

gateway_pid=""
plugin_registry_pid=""
cleanup() {
  if [ -n "${plugin_registry_pid:-}" ]; then
    kill "$plugin_registry_pid" >/dev/null 2>&1 || true
  fi
  daisyclaw_e2e_terminate_gateways "${gateway_pid:-}"
  if [ -s "$SYSTEMCTL_SHIM_PID_FILE" ]; then
    daisyclaw_e2e_terminate_gateways "$(cat "$SYSTEMCTL_SHIM_PID_FILE" 2>/dev/null || true)"
  fi
}
trap cleanup EXIT

configure_configured_plugin_install_fixture_registry() {
  [ "${DAISYCLAW_UPGRADE_SURVIVOR_SCENARIO:-base}" = "configured-plugin-installs" ] || return 0

  local fixture_root="$DAISYCLAW_UPGRADE_SURVIVOR_ARTIFACT_ROOT/configured-plugin-installs-npm-fixture"
  local package_dir="$fixture_root/package"
  local tarball="$fixture_root/daisyclaw-brave-plugin-2026.5.2.tgz"
  local port_file="$fixture_root/npm-registry-port"
  local log_file="$fixture_root/npm-registry.log"
  mkdir -p "$package_dir"
  FIXTURE_PACKAGE_DIR="$package_dir" node <<'"'"'NODE'"'"'
const fs = require("node:fs");
const path = require("node:path");
const root = process.env.FIXTURE_PACKAGE_DIR;
fs.mkdirSync(root, { recursive: true });
fs.writeFileSync(
  path.join(root, "package.json"),
  `${JSON.stringify(
    {
      name: "@daisyclaw/brave-plugin",
      version: "2026.5.2",
      daisyclaw: { extensions: ["./index.js"] },
    },
    null,
    2,
  )}\n`,
);
fs.writeFileSync(
  path.join(root, "daisyclaw.plugin.json"),
  `${JSON.stringify(
    {
      id: "brave",
      activation: { onStartup: false },
      providerAuthEnvVars: { brave: ["BRAVE_API_KEY"] },
      contracts: { webSearchProviders: ["brave"] },
      configSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          webSearch: {
            type: "object",
            additionalProperties: false,
            properties: {
              apiKey: { type: ["string", "object"] },
              mode: { type: "string", enum: ["web", "llm-context"] },
              baseUrl: { type: ["string", "object"] },
            },
          },
        },
      },
    },
    null,
    2,
  )}\n`,
);
fs.writeFileSync(
  path.join(root, "index.js"),
  `module.exports = { id: "brave", name: "Brave Fixture", register() {} };\n`,
);
NODE
  tar -czf "$tarball" -C "$fixture_root" package
  node scripts/e2e/lib/plugins/npm-registry-server.mjs \
    "$port_file" \
    "@daisyclaw/brave-plugin" \
    "2026.5.2" \
    "$tarball" \
    >"$log_file" 2>&1 &
  plugin_registry_pid="$!"

  for _ in $(seq 1 100); do
    if [ -s "$port_file" ]; then
      export NPM_CONFIG_REGISTRY="http://127.0.0.1:$(cat "$port_file")"
      export npm_config_registry="$NPM_CONFIG_REGISTRY"
      return 0
    fi
    if ! kill -0 "$plugin_registry_pid" 2>/dev/null; then
      daisyclaw_e2e_print_log "$log_file" >&2
      return 1
    fi
    sleep 0.1
  done

  daisyclaw_e2e_print_log "$log_file" >&2
  echo "Timed out waiting for configured plugin install npm fixture registry." >&2
  return 1
}

daisyclaw_e2e_eval_test_state_from_b64 "${DAISYCLAW_TEST_STATE_SCRIPT_B64:?missing DAISYCLAW_TEST_STATE_SCRIPT_B64}"
node scripts/e2e/lib/upgrade-survivor/assertions.mjs seed

daisyclaw_e2e_install_package "$DAISYCLAW_UPGRADE_SURVIVOR_ARTIFACT_ROOT/install.log" "upgrade survivor package" "$npm_config_prefix"
command -v daisyclaw >/dev/null
package_version="$(node -p "JSON.parse(require(\"node:fs\").readFileSync(process.argv[1] + \"/lib/node_modules/daisyclaw/package.json\", \"utf8\")).version" "$npm_config_prefix")"
DAISYCLAW_PACKAGE_ACCEPTANCE_LEGACY_COMPAT="$(
  node scripts/e2e/lib/package-compat.mjs "$package_version"
)"
export DAISYCLAW_PACKAGE_ACCEPTANCE_LEGACY_COMPAT

echo "Checking dirty-state config before update..."
DAISYCLAW_UPGRADE_SURVIVOR_ASSERT_STAGE=baseline node scripts/e2e/lib/upgrade-survivor/assertions.mjs assert-config
DAISYCLAW_UPGRADE_SURVIVOR_ASSERT_STAGE=baseline node scripts/e2e/lib/upgrade-survivor/assertions.mjs assert-state
if [ "$UPDATE_RESTART_MODE" = "auto-auth" ]; then
  # shellcheck disable=SC1091
  source scripts/e2e/lib/upgrade-survivor/update-restart-auth.sh
  prepare_update_restart_probe_current_install "$PORT" "$GATEWAY_LOG"
fi

echo "Running package update against the mounted tarball..."
update_args=(update --tag "${DAISYCLAW_CURRENT_PACKAGE_TGZ:?missing DAISYCLAW_CURRENT_PACKAGE_TGZ}" --yes --json)
if [ "$UPDATE_RESTART_MODE" != "auto-auth" ]; then
  update_args+=(--no-restart)
fi
set +e
daisyclaw_e2e_maybe_timeout "$command_timeout" env -u DAISYCLAW_GATEWAY_TOKEN -u DAISYCLAW_GATEWAY_PASSWORD DAISYCLAW_ALLOW_ROOT=1 daisyclaw "${update_args[@]}" >/tmp/daisyclaw-upgrade-survivor-update.json 2>/tmp/daisyclaw-upgrade-survivor-update.err
update_status=$?
set -e
if [ "$update_status" -ne 0 ]; then
  echo "daisyclaw update failed" >&2
  daisyclaw_e2e_print_log /tmp/daisyclaw-upgrade-survivor-update.err >&2
  daisyclaw_e2e_print_log /tmp/daisyclaw-upgrade-survivor-update.json >&2
  exit "$update_status"
fi

if [ "$UPDATE_RESTART_MODE" = "auto-auth" ]; then
  echo "Skipping doctor repair until after restart proof."
else
  echo "Running non-interactive doctor repair..."
  configure_configured_plugin_install_fixture_registry
  if ! daisyclaw_e2e_maybe_timeout "$command_timeout" daisyclaw doctor --fix --non-interactive >/tmp/daisyclaw-upgrade-survivor-doctor.log 2>&1; then
    echo "daisyclaw doctor failed" >&2
    daisyclaw_e2e_print_log /tmp/daisyclaw-upgrade-survivor-doctor.log >&2
    exit 1
  fi
  if ! daisyclaw_e2e_maybe_timeout "$command_timeout" daisyclaw config validate >>/tmp/daisyclaw-upgrade-survivor-doctor.log 2>&1; then
    echo "post-doctor config validation failed" >&2
    daisyclaw_e2e_print_log /tmp/daisyclaw-upgrade-survivor-doctor.log >&2
    exit 1
  fi
fi

echo "Verifying config and state survived update..."
node scripts/e2e/lib/upgrade-survivor/assertions.mjs assert-config
node scripts/e2e/lib/upgrade-survivor/assertions.mjs assert-state

if [ "$UPDATE_RESTART_MODE" = "auto-auth" ]; then
  echo "Gateway restart was handled by daisyclaw update."
else
  echo "Starting gateway from upgraded state..."
  start_epoch="$(node -e "process.stdout.write(String(Date.now()))")"
  daisyclaw gateway --port "$PORT" --bind loopback --allow-unconfigured >"$GATEWAY_LOG" 2>&1 &
  gateway_pid="$!"
  daisyclaw_e2e_wait_gateway_ready "$gateway_pid" "$GATEWAY_LOG" 360 "$PORT"
  ready_epoch="$(node -e "process.stdout.write(String(Date.now()))")"
  start_seconds=$(((ready_epoch - start_epoch + 999) / 1000))
  if [ "$start_seconds" -gt "$START_BUDGET" ]; then
    echo "gateway startup exceeded survivor budget: ${start_seconds}s > ${START_BUDGET}s" >&2
    daisyclaw_e2e_print_log "$GATEWAY_LOG" >&2
    exit 1
  fi
fi

echo "Checking gateway HTTP probes..."
node scripts/e2e/lib/upgrade-survivor/probe-gateway.mjs \
  --base-url "http://127.0.0.1:$PORT" \
  --path /healthz \
  --expect live \
  --out /tmp/daisyclaw-upgrade-survivor-healthz.json
node scripts/e2e/lib/upgrade-survivor/probe-gateway.mjs \
  --base-url "http://127.0.0.1:$PORT" \
  --path /readyz \
  --expect ready \
  --out /tmp/daisyclaw-upgrade-survivor-readyz.json

echo "Checking gateway RPC status..."
status_start="$(node -e "process.stdout.write(String(Date.now()))")"
if ! daisyclaw_e2e_maybe_timeout "$command_timeout" daisyclaw gateway status --url "ws://127.0.0.1:$PORT" --token "$GATEWAY_AUTH_TOKEN_REF" --require-rpc --timeout 30000 --json >/tmp/daisyclaw-upgrade-survivor-status.json 2>/tmp/daisyclaw-upgrade-survivor-status.err; then
  echo "gateway status failed" >&2
  daisyclaw_e2e_print_log /tmp/daisyclaw-upgrade-survivor-status.err >&2
  daisyclaw_e2e_print_log "$GATEWAY_LOG" >&2
  daisyclaw_e2e_print_log "$SYSTEMCTL_SHIM_DAEMON_LOG" >&2
  exit 1
fi
status_end="$(node -e "process.stdout.write(String(Date.now()))")"
status_seconds=$(((status_end - status_start + 999) / 1000))
if [ "$status_seconds" -gt "$STATUS_BUDGET" ]; then
  echo "gateway status exceeded survivor budget: ${status_seconds}s > ${STATUS_BUDGET}s" >&2
  daisyclaw_e2e_print_log /tmp/daisyclaw-upgrade-survivor-status.json >&2
  exit 1
fi
node scripts/e2e/lib/upgrade-survivor/assertions.mjs assert-status-json /tmp/daisyclaw-upgrade-survivor-status.json

echo "Upgrade survivor Docker E2E passed scenario=${DAISYCLAW_UPGRADE_SURVIVOR_SCENARIO:-base} updateRestartMode=${UPDATE_RESTART_MODE} startup=${start_seconds}s status=${status_seconds}s."
'
