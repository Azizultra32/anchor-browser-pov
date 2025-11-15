#!/usr/bin/env bash

set -euo pipefail

PROFILE_DIR=${PROFILE_DIR:-/tmp/anchor-mcp}
PID_DIR="${PROFILE_DIR}/pids"
PORT=${PORT:-9222}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=== Stopping Anchor Browser POC ===${NC}"

# Stop processes by PID files
if [ -d "${PID_DIR}" ]; then
  for pidfile in "${PID_DIR}"/*.pid; do
    if [ -f "$pidfile" ]; then
      pid=$(cat "$pidfile")
      name=$(basename "$pidfile" .pid)
      if kill -0 "$pid" 2>/dev/null; then
        echo "Stopping $name (PID: $pid)..."
        kill "$pid" 2>/dev/null || true
      fi
      rm -f "$pidfile"
    fi
  done
fi

# Also kill by pattern as fallback
echo "Cleaning up any remaining processes..."
pkill -f "remote-debugging-port=${PORT}" 2>/dev/null || true
pkill -f "node.*agent/src/server" 2>/dev/null || true
pkill -f "python3.*http.server.*8788" 2>/dev/null || true

# Clean up lock files
rm -f "${PROFILE_DIR}/.chrome_mcp.lock"

echo -e "${GREEN}All services stopped${NC}"