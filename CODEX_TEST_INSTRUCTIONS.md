# CORRECT TEST COMMANDS FOR CODEX

## Test the GHOST Extension MCP Helper
```bash
cd /Users/ali/GHOST
node mcp-helper.mjs anchor_map_page "file:///Users/ali/GHOST/demo.html"
```

## Test the anchor-browser-poc with Chrome automation
```bash
cd /Users/ali/Downloads/anchor-browser-poc

# 1. Ensure Chrome is running with extension
MCP_SKIP_ENSURE=1 npm run mcp:start

# 2. Test with the GHOST helper (not local mcp-helper)
node /Users/ali/GHOST/mcp-helper.mjs anchor_map_page "https://example.com"

# 3. Or test the agent directly
curl http://localhost:3456/dom
```

## DO NOT RUN
```bash
# This file doesn't exist:
node mcp-helper.mjs anchor_map_page "file:///Users/ali/GHOST/demo.html"
```