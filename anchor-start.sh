#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
CHROME_APP=${CHROME_APP:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
PORT=${PORT:-9222}
PROFILE_DIR=${PROFILE_DIR:-/tmp/anchor-mcp}
EXTENSION_DIR="${ROOT_DIR}/extension/dist"
AGENT_PORT=8787
DEMO_PORT=8788
PID_DIR="${PROFILE_DIR}/pids"

# Log files
CHROME_LOG="/tmp/anchor-chrome.log"
AGENT_LOG="/tmp/anchor-agent.log"
DEMO_LOG="/tmp/anchor-demo.log"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Anchor Browser POC Start ===${NC}"

# Ensure required commands
require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo -e "${RED}Missing required command: $1${NC}" >&2
    exit 1
  fi
}

require_cmd node
require_cmd npm
require_cmd python3
require_cmd curl

# Kill any existing processes
echo "Stopping any existing processes..."
pkill -f "remote-debugging-port=${PORT}" 2>/dev/null || true
pkill -f "node.*agent/src/server" 2>/dev/null || true
pkill -f "python3.*http.server.*${DEMO_PORT}" 2>/dev/null || true
sleep 1

# Clean up old profile if requested
if [ "${CLEAN_PROFILE:-0}" = "1" ]; then
  echo "Cleaning Chrome profile..."
  rm -rf "${PROFILE_DIR}"
fi

# Create directories
mkdir -p "${PROFILE_DIR}"
mkdir -p "${PID_DIR}"

# Build extension
echo -e "\n${YELLOW}Building extension...${NC}"
(cd "${ROOT_DIR}/extension" && npm run build)

if [ ! -d "${EXTENSION_DIR}" ]; then
  echo -e "${RED}Extension build failed - no dist directory${NC}" >&2
  exit 1
fi

# Pre-configure Chrome preferences for Developer Mode
echo -e "\n${YELLOW}Configuring Chrome profile...${NC}"
mkdir -p "${PROFILE_DIR}/Default"
cat > "${PROFILE_DIR}/Default/Preferences" <<'EOF'
{
  "extensions": {
    "ui": {
      "developer_mode": true
    }
  }
}
EOF

# Start Chrome
echo -e "\n${YELLOW}Starting Chrome...${NC}"
"${CHROME_APP}" \
  --remote-debugging-port="${PORT}" \
  --user-data-dir="${PROFILE_DIR}" \
  --load-extension="${EXTENSION_DIR}" \
  --disable-extensions-file-access-check \
  --allow-file-access-from-files \
  --no-first-run \
  --no-default-browser-check \
  >"${CHROME_LOG}" 2>&1 &
CHROME_PID=$!
echo $CHROME_PID > "${PID_DIR}/chrome.pid"
echo "Chrome PID: ${CHROME_PID} (logs: ${CHROME_LOG})"

# Wait for Chrome DevTools
echo "Waiting for Chrome DevTools..."
for i in $(seq 1 20); do
  if curl -sf "http://localhost:${PORT}/json/version" >/dev/null 2>&1; then
    echo -e "${GREEN}Chrome DevTools ready${NC}"
    break
  fi
  sleep 0.5
  if [ "$i" -eq 20 ]; then
    echo -e "${RED}Chrome DevTools failed to start${NC}" >&2
    exit 1
  fi
done

# Start Agent
echo -e "\n${YELLOW}Starting Agent...${NC}"
(cd "${ROOT_DIR}/agent" && npm run dev >"${AGENT_LOG}" 2>&1) &
AGENT_PID=$!
echo $AGENT_PID > "${PID_DIR}/agent.pid"
echo "Agent PID: ${AGENT_PID} (logs: ${AGENT_LOG})"

# Wait for Agent
echo "Waiting for Agent..."
for i in $(seq 1 20); do
  if curl -sf "http://localhost:${AGENT_PORT}/" >/dev/null 2>&1; then
    echo -e "${GREEN}Agent ready${NC}"
    break
  fi
  sleep 0.5
  if [ "$i" -eq 20 ]; then
    echo -e "${RED}Agent failed to start${NC}" >&2
    exit 1
  fi
done

# Start Demo Server
echo -e "\n${YELLOW}Starting Demo Server...${NC}"
(cd "${ROOT_DIR}/demo" && python3 -m http.server ${DEMO_PORT} >"${DEMO_LOG}" 2>&1) &
DEMO_PID=$!
echo $DEMO_PID > "${PID_DIR}/demo.pid"
echo "Demo PID: ${DEMO_PID} (logs: ${DEMO_LOG})"

# Wait for Demo Server
echo "Waiting for Demo Server..."
for i in $(seq 1 10); do
  if curl -sf "http://localhost:${DEMO_PORT}/ehr.html" >/dev/null 2>&1; then
    echo -e "${GREEN}Demo Server ready${NC}"
    break
  fi
  sleep 0.5
  if [ "$i" -eq 10 ]; then
    echo -e "${RED}Demo Server failed to start${NC}" >&2
    exit 1
  fi
done

# Final status
echo -e "\n${GREEN}=== All services started successfully ===${NC}"
echo ""
echo "Chrome DevTools: http://localhost:${PORT}"
echo "Agent API: http://localhost:${AGENT_PORT}"
echo "Demo EHR: http://localhost:${DEMO_PORT}/ehr.html"
echo ""
echo "Extension loaded: ${EXTENSION_DIR}"
echo ""
echo "Logs:"
echo "  Chrome: ${CHROME_LOG}"
echo "  Agent: ${AGENT_LOG}"
echo "  Demo: ${DEMO_LOG}"
echo ""
echo "To stop all services: ./anchor-stop.sh"
echo "To check status: ./anchor-status.sh"
echo "To run smoke test: npm run smoke"