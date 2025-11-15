import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const extensionPath = path.resolve('./extension/dist');
const profilePath = '/tmp/anchor-mcp';

// Create policy file
const policy = {
  ExtensionInstallForcelist: [
    `${extensionPath};https://clients2.google.com/service/update2/crx`
  ],
  ExtensionInstallAllowlist: ["*"],
  ExtensionInstallSources: ["file://*", "http://*", "https://*"],
  DeveloperToolsAvailability: 2
};

// Write policy to profile
const policiesPath = path.join(profilePath, 'policies', 'managed');
fs.mkdirSync(policiesPath, { recursive: true });
fs.writeFileSync(
  path.join(policiesPath, 'chrome.json'),
  JSON.stringify(policy, null, 2)
);

console.log('Policy file created. Restarting Chrome...');

// Kill Chrome
try {
  execSync('pkill -f "remote-debugging-port=9222"');
} catch (e) {}

// Wait a bit
execSync('sleep 2');

// Start Chrome with new policy
console.log('Starting Chrome with extension policy...');