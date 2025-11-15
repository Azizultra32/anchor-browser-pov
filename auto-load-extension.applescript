#!/usr/bin/osascript

-- AppleScript to automatically load Chrome extension
-- This simulates the manual clicks required

on run
    tell application "Google Chrome"
        activate
        
        -- Open extensions page
        open location "chrome://extensions"
        delay 2
        
        -- Enable developer mode via JavaScript
        tell active tab of window 1
            execute javascript "
                const extensionsManager = document.querySelector('extensions-manager');
                if (extensionsManager) {
                    const toolbar = extensionsManager.shadowRoot.querySelector('extensions-toolbar');
                    if (toolbar) {
                        const devModeToggle = toolbar.shadowRoot.querySelector('#devMode');
                        if (devModeToggle && !devModeToggle.checked) {
                            devModeToggle.click();
                        }
                    }
                }
            "
        end tell
        
        delay 1
    end tell
    
    -- Now simulate clicking Load unpacked using accessibility
    tell application "System Events"
        tell process "Google Chrome"
            set frontmost to true
            delay 1
            
            -- Try to find and click the Load unpacked button
            try
                -- Look for the button in the UI
                set loadButton to button "Load unpacked" of UI element 1 of scroll area 1 of group 1 of group 1 of group 1 of window 1
                click loadButton
                
                delay 1
                
                -- Navigate to the extension directory
                keystroke "g" using {command down, shift down}
                delay 0.5
                
                -- Type the path
                keystroke "/Users/ali/Downloads/anchor-browser-poc/extension/dist"
                delay 0.5
                
                -- Press Enter to navigate
                keystroke return
                delay 1
                
                -- Click Choose/Select button
                click button "Select" of sheet 1 of window 1
                
                display notification "Extension loaded successfully!" with title "Chrome Extension Loader"
            on error errMsg
                display notification "Failed: " & errMsg with title "Chrome Extension Loader"
            end try
        end tell
    end tell
end run