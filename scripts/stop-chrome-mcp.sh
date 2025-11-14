#!/usr/bin/env bash

set -euo pipefail

PORT=${PORT:-9222}
PROFILE_DIR=${PROFILE_DIR:-/tmp/chrome-mcp}
LOCK_FILE="${PROFILE_DIR}/.chrome_mcp.lock"
BROWSER_URL="http://localhost:${PORT}"

kill_if_exists() {
  local pattern="$1"
  local pids
  pids=$(pgrep -f "$pattern" || true)
  if [ -n "$pids" ]; then
    echo "Stopping processes matching $pattern: $pids"
    while read -r pid; do
      kill "$pid" 2>/dev/null || true
    done <<<"$pids"
    sleep 0.5
    while read -r pid; do
      if kill -0 "$pid" 2>/dev/null; then
        echo "Force killing $pid"
        kill -9 "$pid" 2>/dev/null || true
      fi
    done <<<"$pids"
  fi
}

if [ -f "$LOCK_FILE" ]; then
  rm -f "$LOCK_FILE"
fi

kill_if_exists "chrome-devtools-mcp --browser-url ${BROWSER_URL}"
kill_if_exists "--remote-debugging-port=${PORT} --user-data-dir=${PROFILE_DIR}"

if [ -d "$PROFILE_DIR" ]; then
  echo "Profile directory remains at $PROFILE_DIR (not removed)."
fi

echo "Chrome MCP services stopped."
