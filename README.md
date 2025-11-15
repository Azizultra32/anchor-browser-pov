# Anchor Browser – Ghost Overlay POC

## Project Overview
Anchor Browser is an experimental Chrome Manifest V3 extension plus a local agent stack that renders a floating “Ghost” overlay on top of a demo EHR page. The goal is to exercise the full Ghost Spine locally: map inputs, send PHI-safe metadata to a local agent, and replay deterministic fill actions. The DOM mapper never transmits real patient values—only labels, selectors, roles, editable flags, and visibility—so the loop remains safe for PHI even when running against live-like forms.

## Components
- `extension/` – Chrome extension (content script, overlay UI, Ghost toggle button, manifest, TypeScript build) that injects the Ghost controls and handles Map → Send → Fill interactions.
- `agent/` – Node/Express agent on `http://localhost:8787` with `/dom` and `/actions/fill` endpoints; stores the latest DOM metadata and returns deterministic fill plans.
- `demo/` – Demo EHR HTML (served via `http://localhost:8788/ehr.html`) that acts as the safe charting surface.
- `scripts/` – Automation utilities (e.g., `check-toggle.mjs`, `smoke.mjs`, Chrome launch helpers) used by `word` and CI to verify the overlay.
- `word` – Bash orchestrator that boots Chrome with remote debugging, starts the agent and demo servers, waits for readiness, and surfaces status/log tails.

## Directory Layout
```
.
├── agent/                 # Express agent with /dom and /actions/fill (npm run dev)
├── demo/                  # demo/ehr.html + fixtures served on :8788
├── docs/                  # Architecture reference docs
├── extension/
│   ├── src/content.ts     # Content script entry for overlay + runtime messages
│   ├── src/overlay.ts     # Ghost overlay, buttons, Map/Send/Fill handlers
│   ├── src/domMapper.ts   # PHI-safe DOM mapper (metadata only)
│   └── build.mjs          # esbuild pipeline to extension/dist
├── logs/                  # Runtime logs captured by word
├── scripts/               # check-toggle.mjs, smoke.mjs, Chrome helpers
├── word                   # ./word ready|status orchestrator
├── tmux-monitor.sh        # Optional tmux helper for long-running sessions
└── package.json           # npm run smoke entry point
```

## Runtime & Ports
- Chrome DevTools: `localhost:9222` – remote-debuggable Chrome that auto-loads the unpacked extension.
- Agent: `http://localhost:8787` – Express API receiving DOM maps and returning fill plans.
- Demo server: `http://localhost:8788` – `python3 -m http.server` hosting `demo/ehr.html`.

## Prerequisites
- macOS with Google Chrome installed at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.
- Node.js 22.x (repo was tested on v22.14.0) and npm; run `npm install` in the repo root for the CDP helpers.
- `npx` access (ships with npm) so the chrome-devtools MCP server can launch.

## Chrome DevTools MCP workflow
1. `npm run mcp:start` (wrapper for `scripts/start-chrome-mcp.sh`)
   - Launches (or reuses) Chrome with `--remote-debugging-port=9222`, a dedicated profile at `/tmp/chrome-mcp`, and a PID/file lock so overlapping sessions are blocked.
   - Uses CDP (`scripts/ensure-extension-state.mjs`) to flip Developer Mode **on** and toggle “Allow access to file URLs” for the unpacked extension before `chrome-devtools-mcp --stdio` starts.
   - Streams Chrome logs to `/tmp/chrome-mcp-browser.log` for later inspection.
2. Use any MCP-capable client (Codex, Windsurf, etc.) to drive Chrome via DevTools.
3. `npm run mcp:map` / `npm run mcp:plan`
   - `mcp:map` navigates to the demo EHR, triggers the Ghost MAP flow via CDP, and prints the latest `DomMap` captured by the extension/agent.
   - `mcp:plan` feeds the latest map into `/actions/plan` to return a deterministic `FillPlan`. Override the target URL/note by editing the script or passing args when calling `node mcp/anchor-server.mjs ...` directly.
4. `npm run mcp:status` (or `node scripts/mcp-health-check.mjs`) at any time to confirm:
   - DevTools endpoint responds
   - Developer Mode is still enabled
   - The unpacked extension is listed with no error badges and file-URL access
   - (Optional) The demo page injects `findCandidates`
5. `npm run mcp:stop` stops both Chrome (for that profile/port) and the `chrome-devtools-mcp` helper, releasing the lock so the next session starts instantly.

> Tip: `scripts/mcp-health-check.mjs --port=XXXX --extension=\"...\" --demo=file:///path` lets you validate other ports/domains too.

## Usage
- `./word ready` – Launch Chrome with the extension, start the agent and demo servers, wait for all three ports, then confirm the Ghost toggle renders on the demo page.
- `./word status` – Print whether Chrome/agent/demo are running, rerun the toggle check, and tail the latest log lines from `logs/`.
- `npm run smoke` – Rebuild the extension, drive Chrome via CDP to load `ehr.html`, click Ghost → Map → Send Map → Fill (Demo), verify demo fields received the deterministic values, and print a `SMOKE PASS` JSON summary.
- `npm run mcp:start|mcp:map|mcp:plan|mcp:status|mcp:stop` – Convenience wrappers for booting, exercising, checking, and stopping the DevTools MCP Chrome profile.
- `npm run health` – Lightweight MCP sanity check (extension listed, Developer Mode on, demo content script injected).
- Optional: `./tmux-monitor.sh` can keep Chrome/agent/demo panes visible for longer sessions, but it is not required for everyday development.

## Current Status / Phase
- Ghost Spine (extension + agent + demo) is implemented and passing `npm run smoke`.
- Toolbar popup controls exist but are still being expanded; document only the behaviors already present in the repo.
