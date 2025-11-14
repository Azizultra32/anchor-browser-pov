#!/usr/bin/env bash
# Start Chrome for Anchor Browser POC testing

set -euo pipefail

PROFILE_DIR="${ANCHOR_PROFILE_DIR:-/tmp/anchor-mcp}"
PORT=9222
EXTENSION_DIR="$(pwd)/extension/dist"

echo "=== Starting Anchor Browser Chrome Instance ==="

# Kill any existing instance
pkill -f "user-data-dir=$PROFILE_DIR" || true
sleep 1

# Ensure extension is built
if [ ! -f "$EXTENSION_DIR/manifest.json" ]; then
  echo "Building extension first..."
  cd extension
  npm run build
  cd ..
fi

# Start Chrome
echo "Starting Chrome..."
echo "  Profile: $PROFILE_DIR"
echo "  Extension: $EXTENSION_DIR"
echo "  Debug port: $PORT"

nohup "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=$PORT \
  --user-data-dir="$PROFILE_DIR" \
  --load-extension="$EXTENSION_DIR" \
  --disable-extensions-file-access-check \
  --allow-file-access-from-files \
  --disable-web-security \
  > /tmp/anchor-chrome.log 2>&1 &

CHROME_PID=$!
echo "Chrome started (PID: $CHROME_PID)"

# Wait for DevTools to be ready
for i in {1..20}; do
  if curl -fs "http://localhost:$PORT/json/version" >/dev/null 2>&1; then
    echo "✅ Chrome DevTools ready at http://localhost:$PORT"
    break
  fi
  sleep 0.5
done

echo ""
echo "Next steps:"
echo "  1. Look for Chrome window with 'controlled by automated test software' banner"
echo "  2. Navigate to: chrome://extensions"
echo "  3. Enable Developer mode (if not already on)"
echo "  4. If extension not loaded, click 'Load unpacked' and select:"
echo "     $EXTENSION_DIR"
echo ""
echo "To test:"
echo "  - Open: http://localhost:8788/ehr.html (or file://$(pwd)/demo/ehr.html)"
echo "  - Press: Ctrl+Alt+G to toggle overlay"
