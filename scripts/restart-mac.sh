#!/usr/bin/env bash
# Reset DaisyClaw like Trimmy: kill running instances, rebuild, repackage, relaunch, verify.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "${ROOT_DIR}/scripts/lib/restart-mac-gateway.sh"
APP_BUNDLE="${DAISYCLAW_APP_BUNDLE:-}"
APP_EXECUTABLE_RELATIVE_PATH="Contents/MacOS/DaisyClaw"
DEBUG_PROCESS_PATTERN="${ROOT_DIR}/apps/macos/.build/debug/DaisyClaw"
LOCAL_PROCESS_PATTERN="${ROOT_DIR}/apps/macos/.build-local/debug/DaisyClaw"
RELEASE_PROCESS_PATTERN="${ROOT_DIR}/apps/macos/.build/release/DaisyClaw"
LAUNCH_AGENT="${HOME}/Library/LaunchAgents/ai.daisyclaw.mac.plist"
LOCK_KEY="$(printf '%s' "${ROOT_DIR}" | shasum -a 256 | cut -c1-8)"
LOCK_DIR="${TMPDIR:-/tmp}/daisyclaw-restart-${LOCK_KEY}"
LOCK_PID_FILE="${LOCK_DIR}/pid"
WAIT_FOR_LOCK=0
LOG_PATH="${DAISYCLAW_RESTART_LOG:-${TMPDIR:-/tmp}/daisyclaw-restart-${LOCK_KEY}.log}"
NO_SIGN=0
SIGN=0
AUTO_DETECT_SIGNING=1
GATEWAY_WAIT_SECONDS="${DAISYCLAW_GATEWAY_WAIT_SECONDS:-0}"
LAUNCHAGENT_DISABLE_MARKER="${HOME}/.daisyclaw/disable-launchagent"
ATTACH_ONLY=1

log()  { printf '%s\n' "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

# Ensure local node binaries (rolldown, pnpm) are discoverable for the steps below.
export PATH="${ROOT_DIR}/node_modules/.bin:${PATH}"

run_step() {
  local label="$1"; shift
  log "==> ${label}"
  if ! "$@"; then
    fail "${label} failed"
  fi
}

cleanup() {
  if [[ -d "${LOCK_DIR}" ]]; then
    rm -rf "${LOCK_DIR}"
  fi
}

acquire_lock() {
  while true; do
    if mkdir "${LOCK_DIR}" 2>/dev/null; then
      echo "$$" > "${LOCK_PID_FILE}"
      return 0
    fi

    local existing_pid=""
    if [[ -f "${LOCK_PID_FILE}" ]]; then
      existing_pid="$(cat "${LOCK_PID_FILE}" 2>/dev/null || true)"
    fi

    if [[ -n "${existing_pid}" ]] && kill -0 "${existing_pid}" 2>/dev/null; then
      if [[ "${WAIT_FOR_LOCK}" == "1" ]]; then
        log "==> Another restart is running (pid ${existing_pid}); waiting..."
        while kill -0 "${existing_pid}" 2>/dev/null; do
          sleep 1
        done
        continue
      fi
      log "==> Another restart is running (pid ${existing_pid}); re-run with --wait."
      exit 0
    fi

    rm -rf "${LOCK_DIR}"
  done
}

check_signing_keys() {
  security find-identity -p codesigning -v 2>/dev/null \
    | grep -Eq '(Developer ID Application|Apple Distribution|Apple Development)'
}

canonicalize_app_bundle() {
  if [[ -z "${APP_BUNDLE}" ]]; then
    return 0
  fi
  if [[ ! -d "${APP_BUNDLE}" ]]; then
    fail "DAISYCLAW_APP_BUNDLE does not exist: ${APP_BUNDLE}"
  fi
  APP_BUNDLE="$(cd "${APP_BUNDLE}" && pwd -P)"
}

trap cleanup EXIT INT TERM

for arg in "$@"; do
  case "${arg}" in
    --wait|-w) WAIT_FOR_LOCK=1 ;;
    --no-sign) NO_SIGN=1; AUTO_DETECT_SIGNING=0 ;;
    --sign) SIGN=1; AUTO_DETECT_SIGNING=0 ;;
    --attach-only) ATTACH_ONLY=1 ;;
    --no-attach-only) ATTACH_ONLY=0 ;;
    --help|-h)
      log "Usage: $(basename "$0") [--wait] [--no-sign] [--sign] [--attach-only|--no-attach-only]"
      log "  --wait    Wait for other restart to complete instead of exiting"
      log "  --no-sign Force no code signing (fastest for development)"
      log "  --sign    Force code signing (will fail if no signing key available)"
      log "  --attach-only    Launch app with --attach-only (skip launchd install)"
      log "  --no-attach-only Launch app without attach-only override"
      log ""
      log "Env:"
      log "  DAISYCLAW_GATEWAY_WAIT_SECONDS=0  Wait time before gateway port check (unsigned only)"
      log ""
      log "Unsigned recovery:"
      log "  node daisyclaw.mjs daemon install --force --runtime node"
      log "  node daisyclaw.mjs daemon restart"
      log ""
      log "Reset unsigned overrides:"
      log "  rm ~/.daisyclaw/disable-launchagent"
      log ""
      log "Default behavior: Auto-detect signing keys, fallback to --no-sign if none found"
      exit 0
      ;;
    *) ;;
  esac
done

if [[ "$NO_SIGN" -eq 1 && "$SIGN" -eq 1 ]]; then
  fail "Cannot use --sign and --no-sign together"
fi
canonicalize_app_bundle

mkdir -p "$(dirname "$LOG_PATH")"
rm -f "$LOG_PATH"
exec > >(tee "$LOG_PATH") 2>&1
log "==> Log: ${LOG_PATH}"
if [[ "$NO_SIGN" -eq 1 ]]; then
  log "==> Using --no-sign (unsigned flow enabled)"
fi
if [[ "$ATTACH_ONLY" -eq 1 ]]; then
  log "==> Using --attach-only (skip launchd install)"
fi

acquire_lock

kill_all_daisyclaw() {
  for _ in {1..10}; do
    local pids=""
    pids="$(daisyclaw_process_pids)"
    if [[ -z "${pids}" ]]; then
      return 0
    fi
    while IFS= read -r pid; do
      kill "${pid}" 2>/dev/null || true
    done <<< "${pids}"
    sleep 0.3
  done
  [[ -z "$(daisyclaw_process_pids)" ]]
}

known_daisyclaw_executables() {
  if [[ -n "${APP_BUNDLE}" ]]; then
    printf '%s\n' "${APP_BUNDLE}/${APP_EXECUTABLE_RELATIVE_PATH}"
  fi
  printf '%s\n' \
    "${ROOT_DIR}/dist/DaisyClaw.app/${APP_EXECUTABLE_RELATIVE_PATH}" \
    "/Applications/DaisyClaw.app/${APP_EXECUTABLE_RELATIVE_PATH}" \
    "${DEBUG_PROCESS_PATTERN}" \
    "${LOCAL_PROCESS_PATTERN}" \
    "${RELEASE_PROCESS_PATTERN}"
}

daisyclaw_process_pids() {
  local pattern=""
  while IFS= read -r pattern; do
    [[ -n "${pattern}" ]] || continue
    process_pids_matching "${pattern}"
  done < <(known_daisyclaw_executables) | sort -u
}

process_pids_matching() {
  local pattern="$1"
  ps axww -o pid=,command= 2>/dev/null \
    | while read -r pid command_line; do
        [[ "${pid}" =~ ^[0-9]+$ ]] || continue
        [[ "${pid}" != "$$" ]] || continue
        [[ "${command_line}" == *"${pattern}"* ]] || continue
        printf '%s\n' "${pid}"
      done
}

stop_launch_agent() {
  launchctl bootout gui/"$UID"/ai.daisyclaw.mac 2>/dev/null || true
}

# 1) Stop launchd supervision, then kill all running instances.
stop_launch_agent
log "==> Killing existing DaisyClaw instances"
if ! kill_all_daisyclaw; then
  fail "DaisyClaw instances did not exit after cleanup attempts"
fi

# Bundle Gateway-hosted plugin assets.
run_step "bundle plugin assets" bash -lc "cd '${ROOT_DIR}' && pnpm plugins:assets:build"

# 2) Rebuild into the same path the packager consumes (.build).
run_step "clean build cache" bash -lc "cd '${ROOT_DIR}/apps/macos' && rm -rf .build .build-swift .swiftpm 2>/dev/null || true"
run_step "swift build" bash -lc "cd '${ROOT_DIR}/apps/macos' && swift build -q --product DaisyClaw"

if [ "$AUTO_DETECT_SIGNING" -eq 1 ]; then
  if check_signing_keys; then
    log "==> Signing keys detected, will code sign"
    SIGN=1
  else
    log "==> No signing keys found, will skip code signing (--no-sign)"
    NO_SIGN=1
  fi
fi

if [ "$NO_SIGN" -eq 1 ]; then
  export ALLOW_ADHOC_SIGNING=1
  export SIGN_IDENTITY="-"
  mkdir -p "${HOME}/.daisyclaw"
  run_step "disable launchagent writes" /usr/bin/touch "${LAUNCHAGENT_DISABLE_MARKER}"
elif [ "$SIGN" -eq 1 ]; then
  if ! check_signing_keys; then
    fail "No signing identity found. Use --no-sign or install a signing key."
  fi
  unset ALLOW_ADHOC_SIGNING
  unset SIGN_IDENTITY
fi

# 3) Package app (no embedded gateway).
run_step "package app" bash -lc "cd '${ROOT_DIR}' && SKIP_TSC=${SKIP_TSC:-1} '${ROOT_DIR}/scripts/package-mac-app.sh'"

choose_app_bundle() {
  if [[ -n "${APP_BUNDLE}" ]]; then
    canonicalize_app_bundle
    return 0
  fi

  if [[ -d "${ROOT_DIR}/dist/DaisyClaw.app" ]]; then
    APP_BUNDLE="$(cd "${ROOT_DIR}/dist/DaisyClaw.app" && pwd -P)"
    if [[ ! -d "${APP_BUNDLE}/Contents/Frameworks/Sparkle.framework" ]]; then
      fail "dist/DaisyClaw.app missing Sparkle after packaging"
    fi
    return 0
  fi

  if [[ -d "/Applications/DaisyClaw.app" ]]; then
    APP_BUNDLE="$(cd "/Applications/DaisyClaw.app" && pwd -P)"
    return 0
  fi

  fail "App bundle not found. Set DAISYCLAW_APP_BUNDLE to your installed DaisyClaw.app"
}

choose_app_bundle

# When signed, clear any previous launchagent override marker.
if [[ "$NO_SIGN" -ne 1 && "$ATTACH_ONLY" -ne 1 && -f "${LAUNCHAGENT_DISABLE_MARKER}" ]]; then
  run_step "clear launchagent disable marker" /bin/rm -f "${LAUNCHAGENT_DISABLE_MARKER}"
fi

# When unsigned, ensure the gateway LaunchAgent targets the repo CLI (before the app launches).
# This reduces noisy "could not connect" errors during app startup.
if [ "$NO_SIGN" -eq 1 ] && [ "$ATTACH_ONLY" -ne 1 ]; then
  run_step "install gateway launch agent (unsigned)" bash -lc "cd '${ROOT_DIR}' && node daisyclaw.mjs daemon install --force --runtime node"
  run_step "restart gateway daemon (unsigned)" bash -lc "cd '${ROOT_DIR}' && node daisyclaw.mjs daemon restart"
  if [[ "${GATEWAY_WAIT_SECONDS}" -gt 0 ]]; then
    run_step "wait for gateway (unsigned)" sleep "${GATEWAY_WAIT_SECONDS}"
  fi
  GATEWAY_PORT="$(
    node -e '
      const fs = require("node:fs");
      const path = require("node:path");
      try {
        const raw = fs.readFileSync(path.join(process.env.HOME, ".daisyclaw", "daisyclaw.json"), "utf8");
        const cfg = JSON.parse(raw);
        const port = cfg && cfg.gateway && typeof cfg.gateway.port === "number" ? cfg.gateway.port : 18789;
        process.stdout.write(String(port));
      } catch {
        process.stdout.write("18789");
      }
    '
  )"
  run_step "verify gateway port ${GATEWAY_PORT} (unsigned)" verify_gateway_port_listening "${GATEWAY_PORT}"
fi

ATTACH_ONLY_ARGS=()
if [[ "$ATTACH_ONLY" -eq 1 ]]; then
  ATTACH_ONLY_ARGS+=(--args --attach-only)
fi

# 4) Launch the installed app in the foreground so the menu bar extra appears.
# LaunchServices can inherit a huge environment from this shell (secrets, prompt vars, etc.).
# That can cause launchd spawn failures and is undesirable for a GUI app anyway.
run_step "launch app" env -i \
  HOME="${HOME}" \
  USER="${USER:-$(id -un)}" \
  LOGNAME="${LOGNAME:-$(id -un)}" \
  TMPDIR="${TMPDIR:-/tmp}" \
  PATH="/usr/bin:/bin:/usr/sbin:/sbin" \
  LANG="${LANG:-en_US.UTF-8}" \
  /usr/bin/open -n "${APP_BUNDLE}" ${ATTACH_ONLY_ARGS[@]:+"${ATTACH_ONLY_ARGS[@]}"}

# 5) Verify the app is alive.
sleep 1.5
if [[ -n "$(process_pids_matching "${APP_BUNDLE}/${APP_EXECUTABLE_RELATIVE_PATH}")" ]]; then
  log "OK: DaisyClaw is running."
else
  fail "App exited immediately. Check ${LOG_PATH} or Console.app (User Reports)."
fi

if [ "$NO_SIGN" -eq 1 ] && [ "$ATTACH_ONLY" -ne 1 ]; then
  run_step "show gateway launch agent args (unsigned)" bash -lc "/usr/bin/plutil -p '${HOME}/Library/LaunchAgents/ai.daisyclaw.gateway.plist' | head -n 40 || true"
fi
