#!/bin/bash
set -x  # Show commands as they execute

# Kill any existing Chrome
pkill -f "remote-debugging-port=9222" || true
sleep 2

# Test with absolute path and all flags
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/anchor-mcp-test \
  --load-extension=/Users/ali/Downloads/anchor-browser-poc/extension/dist \
  --disable-extensions-file-access-check \
  --enable-file-cookies \
  --allow-file-access-from-files \
  --disable-web-security \
  --disable-site-isolation-trials \
  --no-first-run \
  --disable-default-apps \
  --enable-logging \
  --v=1