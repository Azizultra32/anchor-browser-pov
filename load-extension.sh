#!/bin/bash

# This script attempts to load the extension in Chrome
# It requires manual intervention but provides guidance

echo "Opening Chrome extensions page..."
open -a "Google Chrome" "chrome://extensions"

echo ""
echo "=== MANUAL STEPS REQUIRED ==="
echo "1. Enable 'Developer mode' (top right toggle)"
echo "2. Click 'Load unpacked'"
echo "3. Select: /Users/ali/Downloads/anchor-browser-poc/extension/dist"
echo "4. The extension should appear as 'Anchor Ghost Overlay Extension'"
echo ""
echo "Press ENTER when you've loaded the extension..."
read

# Verify extension is loaded
if curl -s http://localhost:9222/json | grep -q 'chrome-extension://'; then
    echo "✓ Extension detected!"
    echo ""
    echo "Now run: npm run smoke"
else
    echo "✗ Extension not detected. Please try again."
fi