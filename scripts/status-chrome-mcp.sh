#!/usr/bin/env bash

set -euo pipefail

PORT=${PORT:-9222}
EXTENSION_NAME=${MCP_EXTENSION_NAME:-"Anchor Ghost Overlay (POC)"}
ARGS=("$@")

node scripts/mcp-health-check.mjs --port="${PORT}" --extension="${EXTENSION_NAME}" "${ARGS[@]}"
