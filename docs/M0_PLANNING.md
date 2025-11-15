# M0: Planning and Setup - COMPLETE

**Status:** ✅ Complete
**Date:** November 15, 2025
**Duration:** 1 day

## Goals Achieved

✅ Requirements & design docs compiled
✅ Architecture defined (step-based, Chrome extension + Agent + MCP)
✅ Development environment set up
✅ POC validated (extension loads, maps DOM, fills fields)
✅ Decision: Extension-based approach (NOT Playwright) for production

## Architecture Decision: Extension vs Playwright

**Decision:** Build on Chrome MV3 Extension architecture (current POC foundation)

**Rationale:**
- Extension provides **browser-native** access to DOM without CDP overhead
- **Shadow DOM isolation** prevents EMR interference
- **Works across any EMR** without requiring DevTools port
- **Lower latency** (no CDP round-trips for DOM access)
- **Better security** (content scripts run in isolated context)
- **Easier deployment** (just install extension vs managing Chrome profiles)

**Playwright role:** Used by MCP server for **browser orchestration** (navigate, click, open tabs), NOT for DOM access/filling.

## System Architecture (Production)

```
┌─────────────────────────────────────────────────┐
│  AI AGENT (GPT-4/Claude/Codex)                  │
│  • Orchestrates clinical workflows              │
│  • Calls MCP tools                               │
└────────────────┬────────────────────────────────┘
                 │ MCP Protocol
┌────────────────▼────────────────────────────────┐
│  MCP SERVER (mcp-server/)                       │
│  • anchor_map_page()                             │
│  • anchor_plan_fill()                            │
│  • anchor_execute_fill()                         │
│  • Uses Playwright for navigation ONLY          │
└────────────────┬────────────────────────────────┘
                 │ Chrome DevTools Protocol
┌────────────────▼────────────────────────────────┐
│  CHROME BROWSER                                  │
│  • Extension: Anchor (auto-loaded)              │
│  • DevTools: localhost:9222                      │
└────────────────┬────────────────────────────────┘
                 │ Extension APIs
┌────────────────▼────────────────────────────────┐
│  ANCHOR EXTENSION (extension/)                   │
│  • Content Script: DOM access + injection        │
│  • Ghost Overlay: Visual UI (Shadow DOM)         │
│  • DOM Mapper: Scan page → field graph          │
│  • Fill Engine: Execute fills + events           │
└────────────────┬────────────────────────────────┘
                 │ HTTP API
┌────────────────▼────────────────────────────────┐
│  LOCAL AGENT (agent/)                            │
│  • Planning Engine: Note → field assignments    │
│  • PHI Guardian: Scrub sensitive data           │
│  • Knowledge Base: EMR-specific heuristics      │
└─────────────────────────────────────────────────┘
```

## Project Structure

```
anchor-browser-poc/
├── extension/              # Chrome MV3 Extension
│   ├── manifest.json
│   ├── src/
│   │   ├── background.ts   # Service worker
│   │   ├── content.ts      # Content script injection
│   │   ├── overlay.ts      # Ghost UI (Shadow DOM)
│   │   ├── domMapper.ts    # Field extraction
│   │   └── fillEngine.ts   # Fill execution
│   ├── dist/               # Built extension
│   └── build.mjs           # esbuild bundler
├── agent/                  # Local planning agent
│   ├── src/
│   │   ├── server.ts       # Express API
│   │   ├── planner.ts      # Field matching engine
│   │   ├── phi-guardian.ts # PHI scrubbing
│   │   └── schema.ts       # TypeScript types
│   └── package.json
├── mcp-server/             # MCP tools (NEW in M1)
│   ├── src/
│   │   ├── index.ts        # MCP server entry
│   │   ├── tools/
│   │   │   ├── map.ts      # anchor_map_page
│   │   │   ├── plan.ts     # anchor_plan_fill
│   │   │   └── execute.ts  # anchor_execute_fill
│   │   └── chrome.ts       # Playwright bridge
│   └── package.json
├── demo/                   # Test EHR page
│   └── ehr.html
├── scripts/                # DevOps automation
│   ├── start-chrome-mcp.sh
│   ├── ensure-extension-state.mjs
│   └── mcp-health-check.mjs
├── docs/                   # Documentation
│   ├── M0_PLANNING.md      # This file
│   ├── ARCHITECTURE.md     # System design
│   └── SPEC.md             # Complete technical spec
├── anchor                  # Orchestrator script
├── anchor-dashboard.html   # Visual control panel
├── anchor-server.mjs       # Dashboard backend
└── package.json
```

## Development Environment

**Installed:**
- Node.js 22.x
- Chrome (latest stable)
- VS Code with Playwright extension

**Scripts:**
```bash
npm run dashboard    # Visual control panel
./anchor start       # Launch full stack
./anchor stop        # Kill all processes
npm run mcp:start    # Chrome with DevTools
npm run mcp:map      # Test map workflow
npm run smoke        # End-to-end test
```

## POC Validation Results

✅ Extension loads successfully
✅ Content script injects without errors
✅ Ghost overlay renders (Shadow DOM isolated)
✅ DOM mapper scans demo page (12 fields found)
✅ Fill engine inserts text + triggers events
✅ Agent API responds (POST /dom, POST /actions/plan)
✅ PHI scrubbing works (no patient data in logs)

## Key Decisions

1. **Step-Based Automation:** Deprecated section-based schema from old "canvas" project
2. **Extension-First:** Chrome extension handles DOM, Playwright handles orchestration
3. **Local-Only:** No cloud dependencies, all communication via localhost
4. **PHI-Safe by Design:** Multiple scrubbing layers, never log patient data
5. **Visual Confirmation:** Ghost overlay shows all actions before/during execution

## Exit Criteria - ALL MET

✅ Design approved by team
✅ Architecture documented
✅ Dev environment functional
✅ POC demonstrates core concepts
✅ Security model defined
✅ Ready to proceed to M1 (Core Framework Skeleton)

## Next Milestone: M1

**Goal:** Build MCP server with anchor_map_page(), anchor_plan_fill(), anchor_execute_fill() tools.

**Tasks:**
1. Create mcp-server/ directory structure
2. Implement MCP SDK integration
3. Build Playwright bridge for Chrome control
4. Wire up extension → agent → MCP data flow
5. Test full Map → Plan → Execute pipeline
6. Document MCP tool contracts

**Target:** December 1, 2025
