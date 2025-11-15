import puppeteer from 'puppeteer-core';
import { execSync } from 'child_process';

async function loadExtension() {
    try {
        // Connect to existing Chrome instance
        const browser = await puppeteer.connect({
            browserURL: 'http://localhost:9222',
            defaultViewport: null
        });

        console.log('Connected to Chrome');

        // Get pages
        const pages = await browser.pages();
        let extensionsPage = pages.find(p => p.url().includes('chrome://extensions'));
        
        if (!extensionsPage) {
            // Create new extensions page
            extensionsPage = await browser.newPage();
            await extensionsPage.goto('chrome://extensions', {waitUntil: 'networkidle0'});
        }

        console.log('Extensions page loaded');

        // Enable developer mode
        await extensionsPage.evaluate(() => {
            const extensionsManager = document.querySelector('extensions-manager');
            if (extensionsManager) {
                const toolbar = extensionsManager.shadowRoot.querySelector('extensions-toolbar');
                if (toolbar) {
                    const devModeToggle = toolbar.shadowRoot.querySelector('#devMode');
                    if (devModeToggle && !devModeToggle.checked) {
                        devModeToggle.click();
                        console.log('Developer mode enabled');
                    }
                }
            }
        });

        await new Promise(resolve => setTimeout(resolve, 1000));

        // Try using keyboard shortcuts to load extension
        // Cmd+O to open file dialog
        await extensionsPage.keyboard.down('Meta');
        await extensionsPage.keyboard.press('KeyO');
        await extensionsPage.keyboard.up('Meta');

        console.log('File dialog should be open - automation cannot proceed further');
        console.log('Chrome security prevents programmatic file selection');
        
        // Disconnect but keep Chrome running
        await browser.disconnect();

    } catch (error) {
        console.error('Error:', error);
    }
}

// Alternative: Use chrome.management API if we had an extension with permissions
async function tryManagementAPI() {
    try {
        const browser = await puppeteer.connect({
            browserURL: 'http://localhost:9222',
            defaultViewport: null
        });

        const page = await browser.newPage();
        
        // Try to use chrome.management API (would need appropriate permissions)
        const result = await page.evaluate(async () => {
            if (typeof chrome !== 'undefined' && chrome.management) {
                try {
                    // This would work if we had an extension with management permission
                    await chrome.management.installReplacementWebApp();
                    return 'success';
                } catch (err) {
                    return err.message;
                }
            }
            return 'chrome.management not available';
        });

        console.log('Management API result:', result);
        
        await browser.disconnect();
    } catch (error) {
        console.error('Management API error:', error);
    }
}

// Try both approaches
loadExtension().then(() => {
    console.log('\nTrying management API approach...');
    return tryManagementAPI();
});