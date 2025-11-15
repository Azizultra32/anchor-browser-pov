#!/usr/bin/env bash
set -euo pipefail
SESSION="anchor-dev"
tmux kill-session -t "$SESSION" 2>/dev/null || true
./word stop || true
echo "Tmux session and services stopped."