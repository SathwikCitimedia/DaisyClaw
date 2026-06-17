#!/usr/bin/env bash
# Runs a deterministic packaged Gateway/code-mode/MCP smoke using the Docker
# functional image and the local mock OpenAI Responses server.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/lib/docker-e2e-image.sh"

IMAGE_NAME="$(docker_e2e_resolve_image "daisyclaw-mcp-code-mode-gateway-e2e" DAISYCLAW_IMAGE)"
PORT="${DAISYCLAW_MCP_CODE_MODE_GATEWAY_PORT:-18789}"
MOCK_PORT="${DAISYCLAW_MCP_CODE_MODE_MOCK_PORT:-44082}"
TOKEN="mcp-code-mode-e2e-$(date +%s)-$$"
CONTAINER_NAME="daisyclaw-mcp-code-mode-e2e-$$"
CLIENT_LOG="$(mktemp -t daisyclaw-mcp-code-mode-client-log.XXXXXX)"

cleanup() {
  docker_e2e_docker_cmd rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  rm -f "$CLIENT_LOG"
}
trap cleanup EXIT

docker_e2e_build_or_reuse "$IMAGE_NAME" mcp-code-mode-gateway
DAISYCLAW_TEST_STATE_SCRIPT_B64="$(docker_e2e_test_state_shell_b64 mcp-code-mode-gateway empty)"

echo "Running in-container deterministic Gateway code-mode MCP API-file smoke..."
set +e
docker_e2e_run_with_harness \
  --name "$CONTAINER_NAME" \
  -e "DAISYCLAW_GATEWAY_TOKEN=$TOKEN" \
  -e "DAISYCLAW_SKIP_CHANNELS=1" \
  -e "DAISYCLAW_SKIP_GMAIL_WATCHER=1" \
  -e "DAISYCLAW_SKIP_CRON=1" \
  -e "DAISYCLAW_SKIP_CANVAS_HOST=1" \
  -e "DAISYCLAW_SKIP_ACPX_RUNTIME=1" \
  -e "DAISYCLAW_SKIP_ACPX_RUNTIME_PROBE=1" \
  -e "DAISYCLAW_TEST_STATE_SCRIPT_B64=$DAISYCLAW_TEST_STATE_SCRIPT_B64" \
  -e "GW_URL=http://127.0.0.1:$PORT" \
  -e "GW_TOKEN=$TOKEN" \
  -e "DAISYCLAW_ALLOW_INSECURE_PRIVATE_WS=1" \
  "$IMAGE_NAME" \
  bash -lc "set -euo pipefail
    source scripts/lib/daisyclaw-e2e-instance.sh
    daisyclaw_e2e_eval_test_state_from_b64 \"\${DAISYCLAW_TEST_STATE_SCRIPT_B64:?missing DAISYCLAW_TEST_STATE_SCRIPT_B64}\"
    entry=\"\$(daisyclaw_e2e_resolve_entrypoint)\"
    export DAISYCLAW_DOCKER_OPENAI_BASE_URL=\"http://127.0.0.1:$MOCK_PORT/v1\"
    mock_pid=\"\$(daisyclaw_e2e_start_mock_openai \"$MOCK_PORT\" /tmp/mcp-code-mode-mock-openai.log)\"
    gateway_pid=
    cleanup_inner() {
      daisyclaw_e2e_stop_process \"\${gateway_pid:-}\"
      daisyclaw_e2e_stop_process \"\${mock_pid:-}\"
    }
    dump_logs_on_error() {
      status=\$?
      if [ \"\$status\" -ne 0 ]; then
        daisyclaw_e2e_dump_logs \
          /tmp/mcp-code-mode-gateway.log \
          /tmp/mcp-code-mode-seed.log \
          /tmp/mcp-code-mode-mock-openai.log
      fi
      cleanup_inner
      exit \"\$status\"
    }
    trap cleanup_inner EXIT
    trap dump_logs_on_error ERR
    daisyclaw_e2e_wait_mock_openai \"$MOCK_PORT\"
    tsx scripts/e2e/mcp-code-mode-gateway-seed.ts >/tmp/mcp-code-mode-seed.log
    gateway_pid=\"\$(daisyclaw_e2e_start_gateway \"\$entry\" $PORT /tmp/mcp-code-mode-gateway.log)\"
    daisyclaw_e2e_wait_gateway_ready \"\$gateway_pid\" /tmp/mcp-code-mode-gateway.log 480 $PORT
    tsx scripts/e2e/mcp-code-mode-gateway-client.ts
  " >"$CLIENT_LOG" 2>&1
status=${PIPESTATUS[0]}
set -e

if [ "$status" -ne 0 ]; then
  echo "Docker MCP code-mode API-file smoke failed"
  docker_e2e_print_log "$CLIENT_LOG"
  exit "$status"
fi

docker_e2e_print_log "$CLIENT_LOG"
echo "OK"
