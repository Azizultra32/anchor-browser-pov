#!/usr/bin/env bash

set -euo pipefail

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PORT=${PORT:-9222}
AGENT_PORT=8787
DEMO_PORT=8788
PROFILE_DIR=${PROFILE_DIR:-/tmp/anchor-mcp}

echo -e "${YELLOW}=== Anchor Browser POC Status ===${NC}"
echo ""

# Overall status
ALL_GOOD=true

# Check Chrome DevTools
echo -n "Chrome DevTools (port ${PORT}): "
if curl -sf "http://localhost:${PORT}/json/version" >/dev/null 2>&1; then
  echo -e "${GREEN}✓ RUNNING${NC}"
  
  # Check if extension is loaded
  echo -n "  Extension loaded: "
  EXTENSION_CHECK=$(curl -sf "http://localhost:${PORT}/json" | grep -c "chrome-extension://" || echo "0")
  if [ "$EXTENSION_CHECK" -gt 0 ]; then
    echo -e "${GREEN}✓ YES${NC}"
  else
    echo -e "${RED}✗ NO${NC}"
    ALL_GOOD=false
  fi
else
  echo -e "${RED}✗ NOT RUNNING${NC}"
  ALL_GOOD=false
fi

# Check Agent
echo -n "Agent (port ${AGENT_PORT}): "
if curl -sf "http://localhost:${AGENT_PORT}/" >/dev/null 2>&1; then
  echo -e "${GREEN}✓ RUNNING${NC}"
else
  echo -e "${RED}✗ NOT RUNNING${NC}"
  ALL_GOOD=false
fi

# Check Demo Server
echo -n "Demo Server (port ${DEMO_PORT}): "
if curl -sf "http://localhost:${DEMO_PORT}/ehr.html" >/dev/null 2>&1; then
  echo -e "${GREEN}✓ RUNNING${NC}"
else
  echo -e "${RED}✗ NOT RUNNING${NC}"
  ALL_GOOD=false
fi

# Check process PIDs
echo ""
echo "Process PIDs:"
if [ -d "${PROFILE_DIR}/pids" ]; then
  for pidfile in "${PROFILE_DIR}/pids"/*.pid; do
    if [ -f "$pidfile" ]; then
      pid=$(cat "$pidfile")
      name=$(basename "$pidfile" .pid)
      if kill -0 "$pid" 2>/dev/null; then
        echo "  $name: $pid ✓"
      else
        echo "  $name: $pid (stale)"
      fi
    fi
  done
else
  echo "  No PID files found"
fi

# Log locations
echo ""
echo "Log files:"
echo "  Chrome: /tmp/anchor-chrome.log"
echo "  Agent: /tmp/anchor-agent.log"
echo "  Demo: /tmp/anchor-demo.log"

# Final status
echo ""
if [ "$ALL_GOOD" = true ]; then
  echo -e "${GREEN}=== All systems operational ===${NC}"
  exit 0
else
  echo -e "${RED}=== Some services are not running ===${NC}"
  echo "Run ./anchor-start.sh to start all services"
  exit 1
fi