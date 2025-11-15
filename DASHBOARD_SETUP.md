# Anchor Browser Visual Dashboard Setup

## Quick Start

```bash
cd /Users/ali/Downloads/anchor-browser-poc
npm install
npm run dashboard
```

The dashboard will auto-open at `http://localhost:3000`

## What Was Built

### 1. Visual Dashboard (`anchor-dashboard.html`)

Beautiful gradient UI with big buttons:
- 🚀 **Start System** - Purple gradient, launches everything
- 🛑 **Stop** - Pink gradient, kills all processes
- 📊 **Status** - Blue gradient, health check + logs
- 📸 **Snapshot** - Green gradient, creates timestamped git branch
- ♻️ **Restore** - Orange gradient, restore after reboot

**Features:**
- Real-time service status cards (Chrome/Agent/Demo with ✓/✗)
- Live logs display with terminal styling
- Auto-refresh status every 5 seconds
- Quick links to Demo EHR, DevTools, Agent API

### 2. Backend Server (`anchor-server.mjs`)

Express server that executes `./anchor` commands via API:

```javascript
#!/usr/bin/env node
import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';
import { platform } from 'os';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Serve the dashboard at root
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'anchor-dashboard.html'));
});

// Execute anchor commands
app.post('/api/anchor', async (req, res) => {
  const { command, args } = req.body;

  const validCommands = ['start', 'stop', 'status', 'snapshot', 'restore'];
  if (!validCommands.includes(command)) {
    return res.status(400).json({ error: 'Invalid command' });
  }

  try {
    const cmd = args
      ? `./anchor ${command} ${JSON.stringify(args)}`
      : `./anchor ${command}`;

    const { stdout, stderr } = await execAsync(cmd, {
      cwd: __dirname,
      timeout: 60000
    });

    res.json({
      success: true,
      output: stdout + stderr
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      output: error.stdout + error.stderr || error.message
    });
  }
});

// Check service status
app.get('/api/status', async (req, res) => {
  try {
    const checkPort = async (port) => {
      try {
        await execAsync(`nc -z 127.0.0.1 ${port}`, { timeout: 2000 });
        return true;
      } catch {
        return false;
      }
    };

    const checkDevTools = async () => {
      try {
        await execAsync('curl -sf http://127.0.0.1:9222/json/version', { timeout: 2000 });
        return true;
      } catch {
        return false;
      }
    };

    const [chrome, agent, demo] = await Promise.all([
      checkDevTools(),
      checkPort(8787),
      checkPort(8788)
    ]);

    res.json({ chrome, agent, demo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`
╔═══════════════════════════════════════════════╗
║   🎯 Anchor Browser Control Panel            ║
║                                               ║
║   Dashboard: ${url}           ║
║                                               ║
║   Press Ctrl+C to stop                        ║
╚═══════════════════════════════════════════════╝
  `);

  // Auto-open browser
  const openCmd = platform() === 'darwin' ? 'open' :
                  platform() === 'win32' ? 'start' : 'xdg-open';

  exec(`${openCmd} ${url}`, (error) => {
    if (error) {
      console.log(`\n   💡 Open ${url} in your browser\n`);
    }
  });
});
```

### 3. Anchor Orchestrator Script (`./anchor`)

One-button system to manage entire stack:

```bash
#!/usr/bin/env bash
# ANCHOR ONE BUTTON SYSTEM
# ---------------------------------------------------
# ./anchor start       → Launch entire environment
# ./anchor restore     → Restore environment after reboot
# ./anchor snapshot    → Safe Git backup (timestamped)
# ./anchor stop        → Kill everything
# ./anchor status      → Health + logs
# ./anchor tmux        → Optional so you can use tmux dashboard
# ---------------------------------------------------

set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
EXT_DIR="$ROOT/extension"
EXT_DIST="$EXT_DIR/dist"
AGENT_DIR="$ROOT/agent"
DEMO_DIR="$ROOT/demo"
LOG_DIR="$ROOT/logs"
PID_DIR="$ROOT/.pids"

PORT_DEVTOOLS=9222
PORT_AGENT=8787
PORT_DEMO=8788
PROFILE_DIR="/tmp/anchor-mcp"

CHROME_BIN="${CHROME_BINARY:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

mkdir -p "$LOG_DIR" "$PID_DIR"

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing: $1"; exit 1; }; }
port_ready() { nc -z 127.0.0.1 "$1" >/dev/null 2>&1; }

json_ok(){ curl -sf "http://127.0.0.1:$PORT_DEVTOOLS/json/version" >/dev/null 2>&1; }

# ---------------------------
# STOP EVERYTHING
# ---------------------------
stop_all() {
  echo "[anchor] Stopping…"

  for f in chrome agent demo; do
    if [ -f "$PID_DIR/$f.pid" ]; then
      PID=$(cat "$PID_DIR/$f.pid")
      kill "$PID" 2>/dev/null || true
      rm -f "$PID_DIR/$f.pid"
    fi
  done

  pkill -f "remote-debugging-port=$PORT_DEVTOOLS" 2>/dev/null || true

  echo "[anchor] ✓ STOPPED"
}

# ---------------------------
# BUILD EXTENSION
# ---------------------------
build_extension() {
  echo "[anchor] Building extension…"
  ( cd "$EXT_DIR" && npm i >/dev/null 2>&1 && npm run build ) ||
    { echo "Build failed"; exit 1; }
  echo "[anchor] ✓ build complete"
}

# ---------------------------
# START DEMO SERVER
# ---------------------------
start_demo() {
  if port_ready "$PORT_DEMO"; then
    echo "[anchor] Demo already running"
    return
  fi
  echo "[anchor] Starting demo server..."
  ( cd "$DEMO_DIR" && nohup python3 -m http.server "$PORT_DEMO" >"$LOG_DIR/demo.log" 2>&1 & echo $! >"$PID_DIR/demo.pid" )
  sleep 1
  echo "[anchor] ✓ demo ready"
}

# ---------------------------
# START AGENT
# ---------------------------
start_agent() {
  if port_ready "$PORT_AGENT"; then
    echo "[anchor] Agent already running"
    return
  fi
  echo "[anchor] Starting agent…"
  ( cd "$AGENT_DIR" && npm i >/dev/null 2>&1 && nohup npm run dev >"$LOG_DIR/agent.log" 2>&1 & echo $! >"$PID_DIR/agent.pid" )
  sleep 2
  echo "[anchor] ✓ agent ready"
}

# ---------------------------
# START CHROME
# ---------------------------
start_chrome() {
  pkill -f "$PROFILE_DIR" 2>/dev/null || true

  echo "[anchor] Launching Chrome…"
  nohup "$CHROME_BIN" \
    --remote-debugging-port="$PORT_DEVTOOLS" \
    --user-data-dir="$PROFILE_DIR" \
    --disable-extensions-except="$EXT_DIST" \
    --load-extension="$EXT_DIST" \
    --allow-file-access-from-files \
    --disable-web-security \
    >"$LOG_DIR/chrome.log" 2>&1 &
  echo $! >"$PID_DIR/chrome.pid"

  for i in {1..40}; do
    json_ok && break
    sleep 0.25
  done

  json_ok || { echo "DevTools not ready"; exit 1; }

  echo "[anchor] ✓ Chrome ready"
}

# ---------------------------
# OPEN DEMO TAB
# ---------------------------
open_demo_tab() {
  URL="http://127.0.0.1:$PORT_DEMO/ehr.html"
  curl -sf "http://127.0.0.1:$PORT_DEVTOOLS/json/new?$URL" >/dev/null 2>&1 || true
  echo "[anchor] ✓ demo page opened"
}

# ---------------------------
# SNAPSHOT TO GIT
# ---------------------------
snapshot() {
  need git

  git add -A

  if ! git diff --cached --quiet; then
    git commit -m "snapshot: $*"
  fi

  TS=$(date +%Y%m%d-%H%M%S)
  SNAP="snapshots/$TS"

  git branch -f "$SNAP"
  git tag -f "snapshot-$TS"

  if git remote get-url origin >/dev/null 2>&1; then
    git push -u origin "$SNAP" --tags
    echo "[anchor] ✓ snapshot pushed → branch $SNAP"
  else
    echo "[anchor] No git remote found. Snapshot saved locally."
  fi
}

# ---------------------------
# STATUS
# ---------------------------
status() {
  echo "Chrome : $(json_ok && echo UP || echo DOWN)"
  echo "Agent  : $(port_ready $PORT_AGENT && echo UP || echo DOWN)"
  echo "Demo   : $(port_ready $PORT_DEMO && echo UP || echo DOWN)"

  echo "--- chrome.log ---"
  tail -n 10 "$LOG_DIR/chrome.log" 2>/dev/null || echo "(none)"
  echo "--- agent.log ---"
  tail -n 10 "$LOG_DIR/agent.log" 2>/dev/null || echo "(none)"
  echo "--- demo.log ---"
  tail -n 10 "$LOG_DIR/demo.log" 2>/dev/null || echo "(none)"
}

# ---------------------------
# MASTER SWITCH
# ---------------------------
case "${1:-}" in
  start)
    build_extension
    start_demo
    start_agent
    start_chrome
    open_demo_tab
    echo "[anchor] SYSTEM ONLINE."
    ;;

  restore)
    ./anchor start
    ;;

  snapshot)
    shift
    snapshot "$*"
    ;;

  stop)
    stop_all
    ;;

  status)
    status
    ;;

  tmux)
    [ -f "$ROOT/tmux-monitor.sh" ] && bash "$ROOT/tmux-monitor.sh" || echo "No tmux-monitor.sh found"
    ;;

  *)
    echo "Usage: ./anchor {start|stop|status|snapshot|tmux|restore}"
    ;;
esac
```

### 4. Package.json Changes

```json
{
  "scripts": {
    "dashboard": "node anchor-server.mjs"
  },
  "dependencies": {
    "express": "^4.19.2",
    "cors": "^2.8.5"
  }
}
```

### 5. .gitignore Updates

```
# Added per instructions
*.pid
.pids/
artifacts/
tmp/
temp/
python-http-cache/
.cache/
```

### 6. README.md Updates

```markdown
## Usage

### Visual Dashboard (Recommended)
- `npm run dashboard` – Launch the visual control panel at `http://localhost:3000`
  - Big colorful buttons for Start/Stop/Status/Snapshot/Restore
  - Real-time service status indicators (Chrome, Agent, Demo)
  - Live logs display
  - Quick links to demo page, DevTools, and agent API

### Command Line
- `./anchor start` – Build extension, launch Chrome with it auto-loaded, start agent and demo servers, open demo page automatically
- `./anchor stop` – Kill all processes (Chrome, agent, demo) and clean up PID files
- `./anchor status` – Check health of all services and show recent logs
- `./anchor snapshot [message]` – Create timestamped Git snapshot branch and push to remote
- `./anchor restore` – Restore environment after reboot (alias for `./anchor start`)
```

## How It Works

1. **Dashboard Frontend** (`anchor-dashboard.html`):
   - Sends POST requests to `/api/anchor` with command
   - Polls `/api/status` every 5 seconds for health checks
   - Updates status cards and logs display

2. **Dashboard Backend** (`anchor-server.mjs`):
   - Executes `./anchor` script with requested command
   - Checks service health via port testing and DevTools endpoint
   - Returns output to frontend

3. **Anchor Script** (`./anchor`):
   - Manages Chrome, Agent, Demo as separate processes
   - Tracks PIDs in `.pids/` directory
   - Logs output to `logs/` directory
   - Auto-loads extension via `--load-extension` flag
   - Opens demo page via Chrome DevTools Protocol

## Troubleshooting

### Chrome shows red X in dashboard

Chrome is not running with remote debugging. Click **Start System** button to launch properly.

### Dashboard won't load

```bash
cd /Users/ali/Downloads/anchor-browser-poc
npm install
npm run dashboard
```

### Extension not loading

The `./anchor start` command automatically loads the extension via `--load-extension` flag. No manual "Load unpacked" needed.

### Ports already in use

```bash
./anchor stop
# Then restart
npm run dashboard
# Click Start System
```

## Architecture

```
┌─────────────────────────────────────────┐
│   Browser: http://localhost:3000       │
│   (Dashboard UI)                        │
└────────────┬────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────┐
│   anchor-server.mjs (Express)           │
│   - /api/anchor (POST) - Execute cmds   │
│   - /api/status (GET) - Health check    │
└────────────┬────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────┐
│   ./anchor script (Bash)                │
│   - Manages Chrome/Agent/Demo           │
│   - PID tracking in .pids/              │
│   - Logs to logs/                       │
└────────────┬────────────────────────────┘
             │
      ┌──────┴──────┬──────────┐
      ↓             ↓          ↓
┌─────────┐  ┌──────────┐  ┌──────┐
│ Chrome  │  │  Agent   │  │ Demo │
│ :9222   │  │  :8787   │  │ :8788│
└─────────┘  └──────────┘  └──────┘
```

## Git Commit

All changes committed and pushed to:
- **Repo**: `git@github.com:Azizultra32/anchor-browser-pov.git`
- **Branch**: `main`
- **Commit**: `d09a353` - feat: visual dashboard with auto-open browser

## Files Modified/Created

### Created:
- `anchor-dashboard.html` - Visual UI
- `anchor-server.mjs` - Express backend
- `anchor` - One-button orchestrator
- `DASHBOARD_SETUP.md` - This file

### Modified:
- `package.json` - Added dashboard script + deps
- `.gitignore` - Added .pids/ directory
- `README.md` - Documented visual dashboard

## Next Steps

1. Run `npm run dashboard`
2. Click **🚀 Start System** button
3. Wait for all three status cards to show ✓
4. Click **Demo EHR** quick link to open demo page
5. Use Ghost overlay to test Map/Send/Fill workflow
