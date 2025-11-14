#!/usr/bin/env bash

set -euo pipefail

CHROME_APP=${CHROME_APP:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
PORT=${PORT:-9222}
PROFILE_DIR=${PROFILE_DIR:-/tmp/chrome-mcp}
EXTENSION_NAME=${MCP_EXTENSION_NAME:-"Anchor Ghost Overlay (POC)"}
LOCK_FILE="${PROFILE_DIR}/.chrome_mcp.lock"
BROWSER_LOG=${MCP_BROWSER_LOG:-/tmp/chrome-mcp-browser.log}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd npx
require_cmd node

if [ ! -x "${CHROME_APP}" ]; then
  echo "Chrome binary not found at ${CHROME_APP}" >&2
  exit 1
fi

mkdir -p "${PROFILE_DIR}"

cleanup() {
  rm -f "${LOCK_FILE}"
}
trap cleanup EXIT

if [ -f "${LOCK_FILE}" ]; then
  existing_pid="$(cat "${LOCK_FILE}")"
  if kill -0 "${existing_pid}" 2>/dev/null; then
    echo "Another chrome-mcp session (PID ${existing_pid}) is already using ${PROFILE_DIR} / port ${PORT}" >&2
    exit 1
  fi
fi

echo "$$" > "${LOCK_FILE}"

if ! pgrep -f "--remote-debugging-port=${PORT} --user-data-dir=${PROFILE_DIR}" >/dev/null 2>&1; then
  echo "Starting Chrome with remote debugging on port ${PORT}..."
  "${CHROME_APP}" \
    --remote-debugging-port="${PORT}" \
    --user-data-dir="${PROFILE_DIR}" \
    --disable-extensions-file-access-check \
    --enable-file-cookies \
    --allow-file-access-from-files \
    --disable-web-security \
    --disable-site-isolation-trials \
    "$@" >"${BROWSER_LOG}" 2>&1 &
  CHROME_PID=$!
  echo "Chrome PID: ${CHROME_PID} (logs -> ${BROWSER_LOG})"
else
  echo "Chrome already running with --remote-debugging-port=${PORT}; reusing existing session"
fi

for i in $(seq 1 40); do
  if curl -sf "http://localhost:${PORT}/json/version" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
  if [ "$i" -eq 40 ]; then
    echo "Timed out waiting for DevTools on port ${PORT}" >&2
    exit 1
  fi
done

echo "Ensuring Developer Mode + file URL access for ${EXTENSION_NAME}..."
if ! node scripts/ensure-extension-state.mjs --port="${PORT}" --extension="${EXTENSION_NAME}"; then
  echo "Unable to confirm extension state; aborting chrome-devtools-mcp launch." >&2
  exit 1
fi

echo "Starting chrome-devtools-mcp (stdio)…"
npx chrome-devtools-mcp --browser-url "http://localhost:${PORT}" --stdio
