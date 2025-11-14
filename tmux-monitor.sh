#!/usr/bin/env bash
# TMUX monitoring solution for Anchor Browser development
# This creates a persistent tmux session with all processes visible

set -euo pipefail

SESSION_NAME="anchor-dev"

# Kill existing session if it exists
tmux kill-session -t "$SESSION_NAME" 2>/dev/null || true

echo "Creating tmux session: $SESSION_NAME"
echo ""

# Create new session with Chrome
tmux new-session -d -s "$SESSION_NAME" -n "chrome" \
  "cd /Users/ali/Downloads/anchor-browser-poc && \
   pkill -f 'remote-debugging-port=9222' || true && \
   sleep 2 && \
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
     --remote-debugging-port=9222 \
     --user-data-dir=/tmp/anchor-mcp \
     --load-extension=/Users/ali/Downloads/anchor-browser-poc/extension/dist \
     --disable-extensions-file-access-check \
     --allow-file-access-from-files \
     --disable-web-security \
     2>&1 | tee /tmp/anchor-chrome.log; \
   bash"

# Add agent window
tmux new-window -t "$SESSION_NAME" -n "agent" \
  "cd /Users/ali/Downloads/anchor-browser-poc/agent && \
   npm run dev 2>&1 | tee /tmp/anchor-agent.log; \
   bash"

# Add demo server window
tmux new-window -t "$SESSION_NAME" -n "demo" \
  "cd /Users/ali/Downloads/anchor-browser-poc/demo && \
   python3 -m http.server 8788 2>&1 | tee /tmp/anchor-demo.log; \
   bash"

# Add monitoring window with 4 panes
tmux new-window -t "$SESSION_NAME" -n "monitor"

# Split into 4 panes for live monitoring
tmux split-window -h -t "$SESSION_NAME:monitor"
tmux split-window -v -t "$SESSION_NAME:monitor.0"
tmux split-window -v -t "$SESSION_NAME:monitor.2"

# Top-left: Chrome log
tmux send-keys -t "$SESSION_NAME:monitor.0" \
  "watch -n 1 'tail -20 /tmp/anchor-chrome.log 2>/dev/null || echo waiting...'" Enter

# Bottom-left: Agent log
tmux send-keys -t "$SESSION_NAME:monitor.1" \
  "watch -n 1 'tail -20 /tmp/anchor-agent.log 2>/dev/null || echo waiting...'" Enter

# Top-right: Status check
tmux send-keys -t "$SESSION_NAME:monitor.2" \
  "watch -n 2 '/Users/ali/Downloads/anchor-browser-poc/monitor-status.sh'" Enter

# Bottom-right: Manual commands
tmux send-keys -t "$SESSION_NAME:monitor.3" \
  "cd /Users/ali/Downloads/anchor-browser-poc && clear && echo 'Manual command pane - run smoke tests here' && bash" Enter

# Add Codex window
tmux new-window -t "$SESSION_NAME" -n "codex" \
  "cd /Users/ali/Downloads/anchor-browser-poc && \
   echo '=== Codex CLI Session ===' && \
   echo 'Run: codex' && \
   echo '' && \
   bash"

# Select the monitor window by default
tmux select-window -t "$SESSION_NAME:monitor"

echo "✅ Tmux session created: $SESSION_NAME"
echo ""
echo "Windows:"
echo "  0: chrome   - Chrome with remote debugging"
echo "  1: agent    - Agent server (port 8787)"
echo "  2: demo     - Demo HTTP server (port 8788)"
echo "  3: monitor  - Live monitoring (4 panes)"
echo "  4: codex    - Codex CLI workspace"
echo ""
echo "To attach: tmux attach -t $SESSION_NAME"
echo "To detach: Press Ctrl+B then D"
echo "To switch windows: Ctrl+B then window number (0-4)"
echo ""
echo "Attaching now..."
sleep 2

# Attach to the session
tmux attach -t "$SESSION_NAME"
