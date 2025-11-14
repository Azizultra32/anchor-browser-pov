#!/usr/bin/env bash

set -euo pipefail

CHROME_APP=${CHROME_APP:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
PORT=${PORT:-9222}
PROFILE_DIR=${PROFILE_DIR:-/tmp/chrome-mcp}

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required to launch chrome-devtools-mcp. Install Node.js / npm first." >&2
  exit 1
fi

if ! pgrep -f "chrome-devtools-mcp" >/dev/null 2>&1; then
  echo "Starting Chrome with remote debugging on port ${PORT}..."
  "${CHROME_APP}" --remote-debugging-port="${PORT}" --user-data-dir="${PROFILE_DIR}" "$@" >/dev/null 2>&1 &
  CHROME_PID=$!
  echo "Chrome PID: ${CHROME_PID}"
else
  echo "chrome-devtools-mcp already running; skipping Chrome launch"
fi

echo "Starting chrome-devtools-mcp (stdio)…"
exec npx chrome-devtools-mcp --browser-url "http://localhost:${PORT}" --stdio
