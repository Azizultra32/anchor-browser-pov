# AFTER RESTART - Quick Recovery Guide

## Where You Are
You have a working Chrome extension (Anchor Browser POC) that:
- Maps form fields on web pages
- Sends data to a local agent
- Fills forms automatically
- Has MCP (Model Context Protocol) integration

## To Get Everything Running Again:

### 1. Start Everything (One Command)
```bash
cd /Users/ali/Downloads/anchor-browser-poc
./anchor-start.sh
```

This starts:
- Chrome with debugging on port 9222
- Agent server on port 8787
- Demo page on port 8788
- Loads the extension automatically

### 2. Check Everything Works
```bash
# Check status
./anchor-status.sh

# Run smoke test
npm run smoke
```

If smoke test passes, you're good!

### 3. Test with MCP Helper
```bash
# Test the Chrome extension via MCP
node /Users/ali/GHOST/mcp-helper.mjs anchor_map_page "http://localhost:8788/ehr.html"
```

### 4. Stop Everything
```bash
./anchor-stop.sh
```

## If Something's Broken

1. **Chrome won't start**: 
   ```bash
   pkill -f "remote-debugging-port=9222"
   ./anchor-start.sh
   ```

2. **Extension not loading**:
   - Check chrome://extensions
   - Look for "Anchor Ghost Overlay (POC)"

3. **Smoke test fails**:
   ```bash
   # Check what's wrong
   node scripts/diagnose-fill.mjs
   node scripts/test-mcp-bridge.mjs
   ```

## What This Project Does
- It's a Chrome extension that helps fill medical forms
- It never sends real patient data (PHI-safe)
- It has an overlay UI with Map/Send/Fill buttons
- It works with a local agent for planning

## The Two Repos
1. **Main Project**: `/Users/ali/Downloads/anchor-browser-poc/` (THIS ONE)
2. **Helper Tools**: `/Users/ali/GHOST/` (has the MCP helper)

## Last Known Good State
- Everything was working
- Smoke tests were passing
- Code is on GitHub at: https://github.com/Azizultra32/anchor-browser-pov

---
TLDR: Run `./anchor-start.sh` and you're back in business!