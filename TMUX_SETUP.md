# TMUX Monitoring Setup

## The Solution to the Blind Spot Problem

This tmux setup gives you **full visibility** into all processes at once.

## Quick Start

### 1. Start Everything
```bash
cd /Users/ali/Downloads/anchor-browser-poc
./tmux-monitor.sh
```

This creates a tmux session with 5 windows:
- **Window 0 (chrome):** Chrome with remote debugging
- **Window 1 (agent):** Agent server on port 8787
- **Window 2 (demo):** Demo HTTP server on port 8788
- **Window 3 (monitor):** Split into 4 panes showing live logs + status
- **Window 4 (codex):** Your Codex CLI workspace

### 2. Navigate Tmux

**Switch between windows:**
- `Ctrl+B` then `0` = Chrome
- `Ctrl+B` then `1` = Agent
- `Ctrl+B` then `2` = Demo server
- `Ctrl+B` then `3` = Monitor (4-pane view)
- `Ctrl+B` then `4` = Codex CLI

**Navigate between panes (in monitor window):**
- `Ctrl+B` then arrow keys

**Detach from tmux (leave it running in background):**
- `Ctrl+B` then `D`

**Reattach later:**
```bash
tmux attach -t anchor-dev
```

### 3. Run Codex in the Tmux Session

1. Switch to Codex window: `Ctrl+B` then `4`
2. Run: `codex`
3. Now you can switch to monitor window and SEE what's happening

### 4. Stop Everything
```bash
./tmux-kill.sh
```

## The Monitor Window Layout

```
┌─────────────────┬─────────────────┐
│ Chrome Log      │ Status Check    │
│ (tail -20)      │ (every 2s)      │
├─────────────────┼─────────────────┤
│ Agent Log       │ Manual Commands │
│ (tail -20)      │ (bash prompt)   │
└─────────────────┴─────────────────┘
```

## Why This Solves the Problem

**Before:**
- No visibility into what Codex is doing
- No way to see if processes are running
- Blind assumptions about background state

**After:**
- **See Chrome logs in real-time** (watch for extension load)
- **See Agent logs in real-time** (watch for requests)
- **See status updates** (ports, PIDs, extension status)
- **Run Codex in a dedicated pane** (visible alongside everything else)

## Troubleshooting

**If extension doesn't load:**
1. Switch to Chrome window (`Ctrl+B` then `0`)
2. See the logs immediately
3. Fix the issue
4. No guessing needed

**If Codex gets stuck:**
1. You can SEE it in the Codex window
2. Kill it with `Ctrl+C`
3. Restart without losing other processes

**If agent crashes:**
1. You see it in the monitor window
2. Switch to agent window to see full error
3. Restart just that window

## Pro Tips

**Kill one window without killing session:**
```bash
# In that window
Ctrl+B then :kill-window
```

**Add more panes to monitor:**
```bash
# While in monitor window
Ctrl+B then "    # Split horizontal
Ctrl+B then %    # Split vertical
```

**Zoom into one pane:**
```bash
Ctrl+B then Z    # Toggle zoom on current pane
```
