# Extension Loading Solution

Chrome's security model prevents fully automated extension loading. Here are your options:

## Option 1: One-Time Manual Load (Recommended)
The extension only needs to be loaded ONCE. Chrome remembers it across restarts.

1. Chrome is already running with DevTools on port 9222
2. Open Chrome window and go to: chrome://extensions
3. Enable "Developer mode" (top right toggle)
4. Click "Load unpacked"
5. Select: `/Users/ali/Downloads/anchor-browser-poc/extension/dist`
6. Run: `npm run smoke`

After this ONE manual load, the extension persists in the profile.

## Option 2: Use Chrome Enterprise Policy (Advanced)
Create a policy file that forces Chrome to load the extension:
```bash
sudo mkdir -p /Library/Managed\ Preferences/com.google.Chrome
sudo tee "/Library/Managed Preferences/com.google.Chrome/com.google.Chrome.plist" > /dev/null <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>ExtensionInstallForcelist</key>
  <array>
    <string>/Users/ali/Downloads/anchor-browser-poc/extension/dist</string>
  </array>
</dict>
</plist>
EOF
```

## Option 3: Use Puppeteer/Playwright (For CI/CD)
These tools can programmatically control Chrome including extension loading.

## Current Status
- ✅ All services running (Chrome, Agent, Demo)
- ✅ Extension built and ready
- ✅ Developer mode can be enabled automatically
- ❌ File dialog for extension selection cannot be automated (Chrome security)

The system is fully functional except for the one-time manual extension load step.