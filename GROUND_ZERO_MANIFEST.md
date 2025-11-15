# GROUND ZERO MANIFEST
## Backup Created: November 15, 2024

### What's Included (Working State)

#### Core Scripts
- ✅ `anchor-start.sh` - Starts Chrome, Agent, Demo server
- ✅ `anchor-stop.sh` - Stops everything cleanly  
- ✅ `anchor-status.sh` - Health check for all services

#### Extension (Working)
- `extension/dist/` - Built extension ready to load
- `extension/src/overlay.ts` - Fixed to handle agent response format
- `extension/src/content.ts` - With MCP bridge
- Manifest v3 with proper permissions

#### Agent (Working)
- `agent/src/server.ts` - Returns `steps` array format
- Running on port 8787
- Endpoints: `/dom`, `/actions/fill`

#### Tests (All Passing)
- `scripts/anchor-smoke.mjs` - Full smoke test ✅
- `scripts/test-mcp-bridge.mjs` - MCP bridge test ✅
- `scripts/diagnose-fill.mjs` - Diagnostic tool

#### Documentation
- `docs/TROUBLESHOOTING.md` - Complete debugging guide
- `.codex/PATTERNS.md` - Working patterns for Codex
- `AFTER_RESTART.md` - Quick recovery guide

### Services Status at Backup
- Chrome DevTools: Port 9222 ✅
- Agent: Port 8787 ✅  
- Demo: Port 8788 ✅
- Extension: Loaded and working ✅
- Smoke Test: PASSING ✅

### GitHub Status
- Repository: https://github.com/Azizultra32/anchor-browser-pov
- Branch: main (up to date)
- Last commit: 613ee9b

### Known Good Commands
```bash
# Start everything
./anchor-start.sh

# Run smoke test
npm run smoke

# Test with MCP
node /Users/ali/GHOST/mcp-helper.mjs anchor_map_page "http://localhost:8788/ehr.html"
```

### What's NOT Included
- node_modules (will be reinstalled)
- .git directory (use GitHub)
- Chrome profile (/tmp/anchor-mcp)
- Log files (/tmp/*.log)

---
This is GROUND ZERO - Everything works at this point!