# Quick Fix for Codex

## The Problem
The smoke test is failing because the agent returns `steps` but the overlay expects `actions`.

## What I Fixed
1. Updated `extension/src/overlay.ts` to handle both `actions` and `steps` arrays
2. Fixed the `stepType()` function to properly detect setValue actions
3. Rebuilt the extension

## What Codex Needs to Do

### 1. Reload the extension in Chrome:
```bash
# The extension has been rebuilt. Now reload it in Chrome:
node -e "
import CDP from 'chrome-remote-interface'
const client = await CDP({ port: 9222 })
const { Runtime } = client
await Runtime.evaluate({
  expression: 'chrome.runtime.reload()',
  // Run in extension context
  contextId: 1
})
await client.close()
console.log('Extension reloaded')
"
```

### 2. Run the smoke test again:
```bash
npm run smoke
```

## If Still Failing

Check what the agent is returning:
```bash
node scripts/diagnose-fill.mjs
```

The agent should return a plan with `steps` array where each step has:
- `selector`: CSS selector
- `action`: "setValue"
- `value`: The value to fill

## Alternative Quick Test
Test the MCP bridge directly:
```bash
node scripts/test-mcp-bridge.mjs
```

## Chrome Still Not Loading Extension?
The extension IS loaded (test-mcp-bridge.mjs proves it). The issue was just the plan format mismatch.