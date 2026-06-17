#!/usr/bin/env bash
set -euo pipefail

source scripts/lib/daisyclaw-e2e-instance.sh
daisyclaw_e2e_eval_test_state_from_b64 "${DAISYCLAW_TEST_STATE_SCRIPT_B64:?missing DAISYCLAW_TEST_STATE_SCRIPT_B64}"
export DAISYCLAW_SKIP_CHANNELS=1
export DAISYCLAW_SKIP_GMAIL_WATCHER=1
export DAISYCLAW_SKIP_CRON=1
export DAISYCLAW_SKIP_CANVAS_HOST=1
export DAISYCLAW_SKIP_BROWSER_CONTROL_SERVER=1
export DAISYCLAW_SKIP_ACPX_RUNTIME=1
export DAISYCLAW_SKIP_ACPX_RUNTIME_PROBE=1
export DAISYCLAW_AGENT_HARNESS_FALLBACK=none
export DAISYCLAW_CODEX_MEDIA_PATH_APP_SERVER_LOG="/tmp/daisyclaw-codex-media-path-app-server.jsonl"

PORT="${PORT:?missing PORT}"
TOKEN="${DAISYCLAW_GATEWAY_TOKEN:?missing DAISYCLAW_GATEWAY_TOKEN}"
PLUGIN_SPEC="${DAISYCLAW_CODEX_MEDIA_PATH_PLUGIN_SPEC:?missing DAISYCLAW_CODEX_MEDIA_PATH_PLUGIN_SPEC}"
GATEWAY_LOG="/tmp/daisyclaw-codex-media-path-gateway.log"
CLIENT_LOG="/tmp/daisyclaw-codex-media-path-client.log"
PLUGIN_INSTALL_LOG="/tmp/daisyclaw-codex-media-path-plugin-install.log"
PLUGIN_INSPECT_LOG="/tmp/daisyclaw-codex-media-path-plugin-inspect.json"
gateway_pid=""

cleanup() {
  daisyclaw_e2e_stop_process "$gateway_pid"
}
trap cleanup EXIT

dump_debug_logs() {
  local status="$1"
  echo "Codex media-path Docker E2E failed with exit code $status" >&2
  daisyclaw_e2e_dump_logs "$PLUGIN_INSTALL_LOG" "$PLUGIN_INSPECT_LOG" "$GATEWAY_LOG" "$CLIENT_LOG" "$DAISYCLAW_CODEX_MEDIA_PATH_APP_SERVER_LOG"
}
trap 'status=$?; dump_debug_logs "$status"; exit "$status"' ERR

entry="$(daisyclaw_e2e_resolve_entrypoint)"
mkdir -p "$DAISYCLAW_STATE_DIR" "$DAISYCLAW_TEST_WORKSPACE_DIR"
rm -f "$DAISYCLAW_CODEX_MEDIA_PATH_APP_SERVER_LOG"

daisyclaw_e2e_enable_daisyclaw_cli_timeout

echo "Installing Codex plugin: $PLUGIN_SPEC"
daisyclaw plugins install "$PLUGIN_SPEC" --force >"$PLUGIN_INSTALL_LOG" 2>&1
daisyclaw plugins inspect codex --runtime --json >"$PLUGIN_INSPECT_LOG"

node scripts/e2e/lib/codex-media-path/write-config.mjs

gateway_pid="$(daisyclaw_e2e_start_gateway "$entry" "$PORT" "$GATEWAY_LOG")"
daisyclaw_e2e_wait_gateway_ready "$gateway_pid" "$GATEWAY_LOG" 480 "$PORT"

PORT="$PORT" DAISYCLAW_GATEWAY_TOKEN="$TOKEN" \
  tsx scripts/e2e/lib/codex-media-path/client.mjs >"$CLIENT_LOG" 2>&1

daisyclaw_e2e_print_log "$CLIENT_LOG"
echo "Codex media-path Docker E2E passed"
