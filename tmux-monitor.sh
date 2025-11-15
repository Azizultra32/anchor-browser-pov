#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
SESSION="anchor-dev"

tmux kill-session -t "$SESSION" 2>/dev/null || true

tmux new-session -d -s "$SESSION" -n "shell" "cd '$ROOT' && bash"

tmux new-window -t "$SESSION" -n "boot" "cd '$ROOT' && ./word ready; bash"

tmux new-window -t "$SESSION" -n "logs"
tmux send-keys -t "$SESSION:logs" "cd '$ROOT/logs' && watch -n 1 'tail -n 20 chrome.log 2>/dev/null || echo waiting…'" Enter
tmux split-window -v -t "$SESSION:logs"
tmux send-keys -t "$SESSION:logs.1" "cd '$ROOT/logs' && watch -n 1 'tail -n 20 agent.log 2>/dev/null || echo waiting…'" Enter
tmux split-window -v -t "$SESSION:logs.1"
tmux send-keys -t "$SESSION:logs.2" "cd '$ROOT/logs' && watch -n 1 'tail -n 20 demo.log 2>/dev/null || echo waiting…'" Enter

tmux new-window -t "$SESSION" -n "status" "cd '$ROOT' && watch -n 2 './word status'"

tmux new-window -t "$SESSION" -n "codex" "cd '$ROOT' && bash"

tmux select-window -t "$SESSION:boot"
tmux attach -t "$SESSION"