#!/usr/bin/osascript

-- Enable JavaScript from Apple Events
tell application "Google Chrome"
    activate
end tell

tell application "System Events"
    tell process "Google Chrome"
        set frontmost to true
        
        -- Access View menu
        click menu item "Developer" of menu "View" of menu bar 1
        delay 0.5
        
        -- Click Allow JavaScript from Apple Events
        click menu item "Allow JavaScript from Apple Events" of menu "Developer" of menu "View" of menu bar 1
    end tell
end tell