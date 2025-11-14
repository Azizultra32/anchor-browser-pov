#!/usr/bin/env bash
# File-based status monitoring that I CAN check

STATUS_FILE="/tmp/anchor-status.txt"

echo "=== Anchor Browser Status @ $(date) ===" > "$STATUS_FILE"
echo "" >> "$STATUS_FILE"

# Chrome
if lsof -i :9222 >/dev/null 2>&1; then
  echo "✅ Chrome on port 9222: RUNNING" >> "$STATUS_FILE"
  CHROME_PID=$(lsof -ti :9222 | head -1)
  echo "   PID: $CHROME_PID" >> "$STATUS_FILE"
else
  echo "❌ Chrome on port 9222: DOWN" >> "$STATUS_FILE"
fi

# Agent
if lsof -i :8787 >/dev/null 2>&1; then
  echo "✅ Agent on port 8787: RUNNING" >> "$STATUS_FILE"
  AGENT_PID=$(lsof -ti :8787 | head -1)
  echo "   PID: $AGENT_PID" >> "$STATUS_FILE"
else
  echo "❌ Agent on port 8787: DOWN" >> "$STATUS_FILE"
fi

# Demo server
if lsof -i :8788 >/dev/null 2>&1; then
  echo "✅ Demo server on port 8788: RUNNING" >> "$STATUS_FILE"
else
  echo "❌ Demo server on port 8788: DOWN" >> "$STATUS_FILE"
fi

# Extension check
echo "" >> "$STATUS_FILE"
echo "Extension Status:" >> "$STATUS_FILE"
if curl -s http://localhost:9222/json 2>/dev/null | grep -q 'chrome-extension://'; then
  echo "✅ Extension pages detected" >> "$STATUS_FILE"
else
  echo "❌ No extension pages found" >> "$STATUS_FILE"
fi

# Recent logs (last 5 lines)
echo "" >> "$STATUS_FILE"
echo "Recent Chrome Log:" >> "$STATUS_FILE"
tail -5 /tmp/anchor-chrome.log 2>/dev/null >> "$STATUS_FILE" || echo "  (no log)" >> "$STATUS_FILE"

echo "" >> "$STATUS_FILE"
echo "Recent Agent Log:" >> "$STATUS_FILE"
tail -5 /tmp/anchor-agent.log 2>/dev/null >> "$STATUS_FILE" || echo "  (no log)" >> "$STATUS_FILE"

# Display
cat "$STATUS_FILE"
