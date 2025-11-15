#!/bin/bash
# Simulate extension loading using GHOST's approach

set -euo pipefail

echo "=== Simulating Extension Load ==="

# Kill Chrome
pkill -f "remote-debugging-port=9222" || true
sleep 2

# Copy GHOST's exact Chrome launch
EXTENSION_DIR="/Users/ali/Downloads/anchor-browser-poc/extension/dist"

# Ensure extension is built
if [ ! -f "$EXTENSION_DIR/manifest.json" ]; then
  echo "Building extension first..."
  npm run build
fi

# Start Chrome with GHOST's exact flags
echo "Starting Chrome with extension..."
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/anchor-mcp \
  --load-extension="$EXTENSION_DIR" \
  --disable-extensions-file-access-check \
  --enable-file-cookies \
  --allow-file-access-from-files \
  --disable-web-security \
  --disable-site-isolation-trials \
  --no-first-run \
  --disable-default-apps \
  > /dev/null 2>&1 &

CHROME_PID=$!
echo "Chrome started with PID $CHROME_PID"

# Wait for Chrome
for i in {1..40}; do
  if curl -fs "http://localhost:9222/json/version" >/dev/null 2>&1; then
    echo "Chrome DevTools ready"
    break
  fi
  sleep 0.5
done

# Check if extension loaded
sleep 2
EXTENSION_CHECK=$(curl -s http://localhost:9222/json | grep -c "chrome-extension://" || true)
if [ "$EXTENSION_CHECK" -gt "2" ]; then
  echo "✅ Extension appears to be loaded (found $EXTENSION_CHECK extension pages)"
else
  echo "⚠️ Extension may not be loaded (only found $EXTENSION_CHECK extension pages)"
fi

echo ""
echo "Now run: npm run smoke"