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
