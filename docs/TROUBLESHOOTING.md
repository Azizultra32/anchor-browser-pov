# Anchor Browser POC - Troubleshooting Guide

This guide captures hard-won debugging wisdom from development sessions.

## Common Issues and Solutions

### 1. Chrome Extension Not Loading

**Symptoms:**
- `test-mcp-bridge.mjs` times out
- No toggle button appears on demo page
- `chrome://extensions` shows no Anchor extension

**Root Causes:**
- Chrome started without `--load-extension` flag
- Wrong extension directory path
- Developer Mode not enabled in Chrome profile

**Solutions:**
```bash
# Use the unified start script that handles everything:
./anchor-start.sh

# Or manually ensure Developer Mode is on:
mkdir -p /tmp/anchor-mcp/Default
echo '{"extensions":{"ui":{"developer_mode":true}}}' > /tmp/anchor-mcp/Default/Preferences
```

### 2. Smoke Test Fails - "No fields were filled"

**Symptoms:**
- MCP bridge works (fields are mapped)
- Agent returns a plan
- But no fields get filled

**Root Cause:**
- Agent returns `steps` array but overlay expects `actions` array
- Field format mismatch between agent response and overlay parser

**Solution:**
The overlay now handles both formats. Check `extension/src/overlay.ts`:
```javascript
function getPlanSteps(plan: any): PlanStep[] {
  if (Array.isArray(plan?.actions)) return plan.actions
  if (Array.isArray(plan?.steps)) return plan.steps
  return []
}
```

**Diagnostic:**
```bash
node scripts/diagnose-fill.mjs
```

### 3. Git Commit Hangs

**Symptoms:**
- Codex says "committing changes" but nothing happens
- Terminal appears stuck

**Root Cause:**
- Complex commit message format
- Heredoc syntax issues
- Git hooks waiting for input

**Solutions:**
```bash
# Option 1: Use the helper script
./commit-helper.sh

# Option 2: Simple one-liner
git add -A && git commit -m "Fix: Handle agent steps array format"

# Option 3: Skip hooks if needed
git commit --no-verify -m "Quick fix"
```

### 4. Multiple Chrome Instances on Port 9222

**Symptoms:**
- "Port already in use" errors
- Conflicting Chrome processes
- MCP helper connects to wrong Chrome

**Root Cause:**
- Previous Chrome instances not cleaned up
- Both GHOST and Anchor repos trying to use same port

**Solution:**
```bash
# Kill all Chrome on port 9222
pkill -f "remote-debugging-port=9222"

# Use dedicated profiles:
# Anchor: /tmp/anchor-mcp
# GHOST: /tmp/chrome-mcp
```

### 5. MCP Helper Can't Find Content Script

**Symptoms:**
- "Timeout waiting for content script to inject"
- Chrome is running but extension not responding

**Root Causes:**
- Using GHOST's reload script for Anchor project
- Extension loaded but content script not injected on current page
- Wrong manifest.json match patterns

**Solutions:**
```bash
# For Anchor project, always use:
cd /Users/ali/Downloads/anchor-browser-poc
./anchor-start.sh

# Test with correct URL:
node /Users/ali/GHOST/mcp-helper.mjs anchor_map_page "http://localhost:8788/ehr.html"
```

## Key Architectural Decisions

### MCP Event Bridge Pattern

Due to Chrome MV3 isolated worlds, we use custom DOM events:

1. **Content Script** listens for `__ANCHOR_MCP_*` events
2. **CDP** dispatches events in page context
3. **Response** comes back via custom events

This avoids the `window.__ANCHOR_GHOST__` undefined error.

### Agent Response Format

The agent (`/actions/fill` endpoint) returns:
```json
{
  "id": "plan_xxx",
  "url": "...",
  "steps": [  // Note: "steps" not "actions"
    {
      "selector": "#field",
      "action": "setValue",  // Note: "action" not "type"
      "value": "...",
      "label": "..."
    }
  ]
}
```

### Directory Structure Clarity

Two separate repos - DO NOT MIX:
- **GHOST**: `/Users/ali/GHOST/` - Has MCP helper tools
- **Anchor**: `/Users/ali/Downloads/anchor-browser-poc/` - Main project

The MCP helper lives in GHOST but tests the Anchor extension.

## Quick Commands Reference

```bash
# Start everything
cd /Users/ali/Downloads/anchor-browser-poc
./anchor-start.sh

# Check status
./anchor-status.sh

# Run smoke test
npm run smoke

# Test MCP bridge
node scripts/test-mcp-bridge.mjs

# Test with GHOST helper
node /Users/ali/GHOST/mcp-helper.mjs anchor_map_page "http://localhost:8788/ehr.html"

# Stop everything
./anchor-stop.sh
```

## Debugging Checklist

When things go wrong, check in order:

1. ✓ Chrome running? `curl -s http://localhost:9222/json/version`
2. ✓ Agent running? `curl -s http://localhost:8787/`
3. ✓ Demo running? `curl -s http://localhost:8788/ehr.html`
4. ✓ Extension loaded? Check for toggle button on demo page
5. ✓ Content script injected? Run `test-mcp-bridge.mjs`
6. ✓ Agent returning correct format? Run `diagnose-fill.mjs`

## Lessons Learned

1. **Always rebuild extension after TypeScript changes**
2. **Agent and overlay must agree on data format**
3. **Use the right start script for the right project**
4. **Kill stray Chrome processes before starting**
5. **Trust the diagnostic scripts over manual debugging**

---
Last updated: November 2024
Generated from debugging session with Codex CLI