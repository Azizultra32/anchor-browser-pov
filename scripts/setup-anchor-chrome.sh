#!/usr/bin/env bash
# ONE-TIME setup to make --load-extension work automatically

set -euo pipefail

PROFILE_DIR="/tmp/anchor-mcp"
EXTENSION_DIR="$(cd "$(dirname "$0")/.." && pwd)/extension/dist"

echo "=== One-Time Anchor Browser Chrome Setup ==="
echo ""

# Step 1: Build extension if needed
if [ ! -f "$EXTENSION_DIR/manifest.json" ]; then
  echo "Building extension..."
  cd "$(dirname "$EXTENSION_DIR")"
  npm run build
  cd - > /dev/null
fi

echo "Extension ready at: $EXTENSION_DIR"
echo ""

# Step 2: Clean profile
echo "Creating fresh Chrome profile..."
rm -rf "$PROFILE_DIR"
mkdir -p "$PROFILE_DIR/Default"

# Step 3: Pre-configure preferences with Developer mode ON
echo "Enabling Developer mode in profile..."
cat > "$PROFILE_DIR/Default/Preferences" << 'PREFS'
{
  "extensions": {
    "ui": {
      "developer_mode": true
    }
  }
}
PREFS

echo "✅ Profile configured"
echo ""

# Step 4: Start Chrome with the extension
echo "Starting Chrome with extension..."
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 \
  --user-data-dir="$PROFILE_DIR" \
  --load-extension="$EXTENSION_DIR" \
  --disable-extensions-file-access-check \
  --allow-file-access-from-files \
  --disable-web-security \
  > /tmp/anchor-chrome.log 2>&1 &

CHROME_PID=$!
echo "Chrome started (PID: $CHROME_PID)"

# Wait for DevTools
for i in {1..20}; do
  if curl -fs "http://localhost:9222/json/version" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

echo "✅ Chrome ready at http://localhost:9222"
echo ""

# Verify extension loaded
sleep 2
EXT_COUNT=$(curl -s http://localhost:9222/json | grep -c 'chrome-extension://' || echo "0")

if [ "$EXT_COUNT" -gt "0" ]; then
  echo "🎉 SUCCESS! Extension auto-loaded!"
  echo ""
  echo "From now on, just run: ./.anchor-chrome.sh"
  echo "The extension will load automatically every time."
else
  echo "❌ Extension didn't auto-load"
  echo ""
  echo "Manual step needed (ONE TIME ONLY):"
  echo "  1. In the Chrome window that just opened:"
  echo "  2. Go to: chrome://extensions"
  echo "  3. Developer mode should already be ON"
  echo "  4. Click 'Load unpacked'"
  echo "  5. Select: $EXTENSION_DIR"
  echo ""
  echo "After doing this once, restart Chrome with ./.anchor-chrome.sh"
  echo "and the extension will load automatically from then on."
fi

echo ""
echo "To test the extension:"
echo "  - Navigate to: http://localhost:8788/ehr.html"
echo "  - Press: Ctrl+Alt+G to toggle overlay"
