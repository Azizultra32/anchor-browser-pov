# Codex CLI Patterns - Anchor Browser POC

This file captures successful patterns for Codex CLI to follow.

## Git Commit Patterns That Work

### Simple Format (Recommended)
```bash
git add -A && git commit -m "Fix: Brief description

- Bullet point 1
- Bullet point 2"
```

### When Codex Gets Stuck on Commits

Create a temporary script:
```bash
cat > /tmp/commit.sh << 'EOF'
#!/bin/bash
git add -A
git commit -m "Your message here"
EOF
chmod +x /tmp/commit.sh
/tmp/commit.sh
```

## Chrome Debugging Patterns

### Check Everything at Once
```bash
# Create a status check
cat > /tmp/check.sh << 'EOF'
echo "Chrome:" && curl -s http://localhost:9222/json/version | grep Browser
echo "Agent:" && curl -s http://localhost:8787/ > /dev/null && echo "OK" || echo "DOWN"  
echo "Demo:" && curl -s http://localhost:8788/ehr.html > /dev/null && echo "OK" || echo "DOWN"
EOF
bash /tmp/check.sh
```

### Reload Extension Without Restart
```javascript
// Save as reload-ext.mjs
import CDP from 'chrome-remote-interface'
const tabs = await CDP.List({ port: 9222 })
const extTab = tabs.find(t => t.url.startsWith('chrome-extension://'))
if (extTab) {
  const client = await CDP({ port: 9222, target: extTab.id })
  await client.Runtime.evaluate({ expression: 'chrome.runtime.reload()' })
  await client.close()
  console.log('Extension reloaded')
}
```

## Testing Patterns

### Quick Smoke Test After Changes
```bash
# Rebuild and test in one go
(cd extension && npm run build) && \
node scripts/test-mcp-bridge.mjs && \
echo "Bridge OK" || echo "Bridge FAIL"
```

### Diagnostic Before Deep Debugging
Always run diagnostics first:
```bash
node scripts/diagnose-fill.mjs  # Check agent format
node scripts/test-mcp-bridge.mjs # Check extension bridge
```

## File Watching Patterns

### Monitor Logs During Debugging
```bash
# In a separate terminal
tail -f /tmp/anchor-*.log
```

### Track File Changes
```bash
# See what files changed recently
find . -name "*.ts" -o -name "*.js" -mmin -10 -ls
```

## Recovery Patterns

### When Everything Is Broken
```bash
# Nuclear option - full restart
./anchor-stop.sh
rm -rf /tmp/anchor-mcp
pkill -f "remote-debugging-port=9222"
sleep 2
./anchor-start.sh
```

### When Only Chrome Is Stuck
```bash
# Gentle restart
pkill -f "remote-debugging-port=9222"
sleep 1
# Then manually start Chrome part only
```

## MCP Helper Patterns

### Always Use Full Path
```bash
# Good
node /Users/ali/GHOST/mcp-helper.mjs anchor_map_page "http://localhost:8788/ehr.html"

# Bad (assumes wrong directory)
node mcp-helper.mjs anchor_map_page "..."
```

### Test Incrementally
```bash
# First test map
node /Users/ali/GHOST/mcp-helper.mjs anchor_map_page "http://localhost:8788/ehr.html"

# Only if map works, test fill
node /Users/ali/GHOST/mcp-helper.mjs anchor_fill_field "#pt_name" "Test"
```

## Error Response Patterns

### When Codex Sees "MODULE_NOT_FOUND"
- Check if running from correct directory
- Verify full paths in commands
- The file might be in GHOST, not Anchor

### When Codex Sees "Timeout waiting for content script"
1. Check Chrome is on right port: `lsof -ti:9222`
2. Check extension loaded: Look for toggle button
3. Check content script match pattern in manifest.json

### When Codex Sees "No fields were filled"
- Run `diagnose-fill.mjs` first
- Check agent response format (steps vs actions)
- Verify stepType detection logic

## Success Indicators

These messages mean things are working:

- "Chrome DevTools ready"
- "Agent ready" 
- "Demo Server ready"
- "MCP bridge working! Found X fields"
- "Extension reloaded"
- "SMOKE PASS"

---
Remember: When in doubt, run the diagnostic scripts!