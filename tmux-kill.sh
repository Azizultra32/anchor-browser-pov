#!/usr/bin/env bash
# Kill the tmux session and all processes

SESSION_NAME="anchor-dev"

echo "Killing tmux session and all processes..."

# Kill tmux session
tmux kill-session -t "$SESSION_NAME" 2>/dev/null && echo "✅ Tmux session killed" || echo "⚠️  No tmux session found"

# Kill processes
pkill -f 'remote-debugging-port=9222' && echo "✅ Chrome killed" || echo "⚠️  Chrome not running"
pkill -f 'anchor-ghost-agent' && echo "✅ Agent killed" || echo "⚠️  Agent not running"
pkill -f 'python3 -m http.server 8788' && echo "✅ Demo server killed" || echo "⚠️  Demo server not running"

echo ""
echo "✅ Cleanup complete"
