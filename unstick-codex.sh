#!/usr/bin/env bash
# Quick script to unstick Codex CLI when it hangs

echo "=== Unsticking Codex CLI ==="
echo ""

echo "1. Killing all Codex processes..."
pkill -f codex || true

echo "2. Killing Chrome on port 9222..."
pkill -f 'remote-debugging-port=9222' || true

echo "3. Waiting for cleanup..."
sleep 3

echo "4. Restarting Chrome..."
cd /Users/ali/Downloads/anchor-browser-poc
bash .anchor-chrome.sh

echo ""
echo "✅ Done!"
echo ""
echo "Now run: codex"
echo "Then paste your task again"
