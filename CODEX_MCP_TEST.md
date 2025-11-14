# Codex CLI MCP Automation Test

## What Codex Should Do With MCP Tools

Paste this into Codex CLI to have it automate the entire test cycle:

```
Use your chrome-devtools MCP tools to:

## Step 1: Verify Extension is Loaded
1. Navigate to chrome://extensions
2. Take a screenshot and save as /Users/ali/Downloads/anchor-browser-poc/codex-check-extensions.png
3. Check if "Anchor Ghost Overlay (POC)" is listed
4. If NOT listed, report: "Extension needs manual load - --load-extension flag didn't work"
5. If listed, check for error badges and report status

## Step 2: Open Demo Page
6. Navigate to http://localhost:8788/ehr.html
7. Wait 2 seconds for page load
8. Capture console logs
9. Check if you see log message containing "[AnchorGhost]" or "content script loaded"
10. If NO log, content script didn't inject - report the issue

## Step 3: Test Overlay Toggle
11. Dispatch keyboard event to toggle overlay:
    ```javascript
    window.dispatchEvent(new KeyboardEvent('keydown', {
      ctrlKey: true,
      altKey: true,
      code: 'KeyG',
      bubbles: true
    }))
    ```
12. Wait 1 second
13. Take screenshot and save as /Users/ali/Downloads/anchor-browser-poc/codex-overlay-test.png
14. Check if overlay UI appeared in the DOM (look for element with class/id related to overlay)

## Step 4: Test Map Function
15. Evaluate this JavaScript to click the "Map" button:
    ```javascript
    document.querySelector('[data-action="map"]').click()
    // or find the Map button another way if needed
    ```
16. Wait 1 second
17. Capture console logs
18. Report what fields were detected

## Step 5: Summary Report
Provide a structured report:
- Extension loaded: YES/NO
- Content script injected: YES/NO
- Overlay toggled successfully: YES/NO
- Map function worked: YES/NO
- Screenshots saved at: [paths]
- Console errors: [if any]
- Recommended next steps: [based on what failed]
```

## Why This Matters

This test:
1. **Verifies extension load** without you clicking around
2. **Tests the full workflow** programmatically
3. **Captures evidence** (screenshots, console logs)
4. **Gives actionable feedback** on what's broken

## After Running This

Codex will tell you exactly what's working and what's not, with visual proof.

Then you can either:
- Fix issues it identified
- Have Codex investigate deeper with more MCP commands
- Move on to the next feature

**No more manual clicking and guessing!**
