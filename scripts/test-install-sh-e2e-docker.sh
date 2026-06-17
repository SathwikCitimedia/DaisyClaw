#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/docker-build.sh"
source "$ROOT_DIR/scripts/lib/docker-e2e-container.sh"
IMAGE_NAME="${DAISYCLAW_INSTALL_E2E_IMAGE:-daisyclaw-install-e2e:local}"
INSTALL_URL="${DAISYCLAW_INSTALL_URL:-https://daisyclaw.bot/install.sh}"
DOCKER_COMMAND_TIMEOUT="${DOCKER_COMMAND_TIMEOUT:-${DAISYCLAW_INSTALL_E2E_DOCKER_TIMEOUT:-2700s}}"
PROFILE_FILE="${DAISYCLAW_INSTALL_E2E_PROFILE_FILE:-${DAISYCLAW_PROFILE_FILE:-${DAISYCLAW_TESTBOX_PROFILE_FILE:-$HOME/.daisyclaw-testbox-live.profile}}}"

OPENAI_API_KEY="${OPENAI_API_KEY:-}"
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"
ANTHROPIC_API_TOKEN="${ANTHROPIC_API_TOKEN:-}"
DAISYCLAW_E2E_MODELS="${DAISYCLAW_E2E_MODELS:-}"

if [ ! -f "$PROFILE_FILE" ] && [ -f "$HOME/.profile" ]; then
  PROFILE_FILE="$HOME/.profile"
fi

PROFILE_STATUS="none"

read_profile_env_value() {
  local key="$1"
  (
    set +u
    # shellcheck disable=SC1090
    source "$PROFILE_FILE" >/dev/null
    printf '%s' "${!key:-}"
  )
}

for key in OPENAI_API_KEY ANTHROPIC_API_KEY ANTHROPIC_API_TOKEN; do
  if [ -f "$PROFILE_FILE" ] && [ -r "$PROFILE_FILE" ] && [ -z "${!key:-}" ]; then
    printf -v "$key" '%s' "$(read_profile_env_value "$key")"
    PROFILE_STATUS="$PROFILE_FILE"
  fi
  if [[ "${!key:-}" == "undefined" || "${!key:-}" == "null" ]]; then
    printf -v "$key" '%s' ""
  fi
  export "$key"
done

echo "==> Build image: $IMAGE_NAME"
docker_build_run install-e2e-build \
  -t "$IMAGE_NAME" \
  -f "$ROOT_DIR/scripts/docker/install-sh-e2e/Dockerfile" \
  "$ROOT_DIR/scripts/docker"

echo "==> Run E2E installer test"
echo "Profile file: $PROFILE_STATUS"
docker_e2e_docker_run_cmd run --rm \
  -e DAISYCLAW_INSTALL_URL="$INSTALL_URL" \
  -e DAISYCLAW_INSTALL_TAG="${DAISYCLAW_INSTALL_TAG:-latest}" \
  -e DAISYCLAW_E2E_MODELS="$DAISYCLAW_E2E_MODELS" \
  -e DAISYCLAW_INSTALL_E2E_OPENAI_MODEL="${DAISYCLAW_INSTALL_E2E_OPENAI_MODEL:-}" \
  -e DAISYCLAW_INSTALL_E2E_OPENAI_PROVIDER_TIMEOUT_SECONDS="${DAISYCLAW_INSTALL_E2E_OPENAI_PROVIDER_TIMEOUT_SECONDS:-}" \
  -e DAISYCLAW_INSTALL_E2E_PREVIOUS="${DAISYCLAW_INSTALL_E2E_PREVIOUS:-}" \
  -e DAISYCLAW_INSTALL_E2E_SKIP_PREVIOUS="${DAISYCLAW_INSTALL_E2E_SKIP_PREVIOUS:-0}" \
  -e DAISYCLAW_INSTALL_E2E_AGENT_TURN_TIMEOUT_SECONDS="${DAISYCLAW_INSTALL_E2E_AGENT_TURN_TIMEOUT_SECONDS:-300}" \
  -e DAISYCLAW_INSTALL_E2E_AGENT_TURNS_PARALLEL="${DAISYCLAW_INSTALL_E2E_AGENT_TURNS_PARALLEL:-1}" \
  -e DAISYCLAW_INSTALL_E2E_AGENT_TOOL_SMOKE="${DAISYCLAW_INSTALL_E2E_AGENT_TOOL_SMOKE:-1}" \
  -e DAISYCLAW_NO_ONBOARD=1 \
  -e OPENAI_API_KEY \
  -e ANTHROPIC_API_KEY \
  -e ANTHROPIC_API_TOKEN \
  "$IMAGE_NAME"
