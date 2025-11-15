import CDP from 'chrome-remote-interface';
import fs from 'fs';
import path from 'path';

async function loadExtension() {
    let client;
    try {
        // Connect to Chrome
        client = await CDP({port: 9222});
        const {Runtime, Page, Target} = client;
        
        console.log('Connected to Chrome DevTools');
        
        // Create a new tab for extensions page
        const {targetId} = await Target.createTarget({url: 'chrome://extensions'});
        console.log('Created extensions tab:', targetId);
        
        // Wait a bit for the page to load
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get all targets to find our extensions page
        const targets = await Target.getTargets();
        const extensionsTarget = targets.targetInfos.find(t => 
            t.url === 'chrome://extensions/' || t.url === 'chrome://extensions'
        );
        
        if (!extensionsTarget) {
            throw new Error('Could not find extensions page');
        }
        
        // Attach to the extensions page
        const {sessionId} = await Target.attachToTarget({
            targetId: extensionsTarget.targetId,
            flatten: true
        });
        
        console.log('Attached to extensions page');
        
        // Enable runtime in the extensions page context
        await client.send('Runtime.enable', {}, sessionId);
        await client.send('Page.enable', {}, sessionId);
        
        // First enable developer mode
        const enableDevMode = await client.send('Runtime.evaluate', {
            expression: `
                (async () => {
                    // Wait for the page to fully load
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    const extensionsManager = document.querySelector('extensions-manager');
                    if (!extensionsManager) return 'No extensions manager found';
                    
                    const toolbar = extensionsManager.shadowRoot.querySelector('extensions-toolbar');
                    if (!toolbar) return 'No toolbar found';
                    
                    const devModeToggle = toolbar.shadowRoot.querySelector('#devMode');
                    if (!devModeToggle) return 'No dev mode toggle found';
                    
                    if (!devModeToggle.checked) {
                        devModeToggle.click();
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                    
                    return 'Developer mode enabled';
                })()
            `,
            awaitPromise: true
        }, sessionId);
        
        console.log('Dev mode result:', enableDevMode.result.value);
        
        // Now simulate loading unpacked extension
        const loadUnpacked = await client.send('Runtime.evaluate', {
            expression: `
                (async () => {
                    const extensionsManager = document.querySelector('extensions-manager');
                    if (!extensionsManager) return 'No extensions manager found';
                    
                    const toolbar = extensionsManager.shadowRoot.querySelector('extensions-toolbar');
                    if (!toolbar) return 'No toolbar found';
                    
                    const loadUnpackedButton = toolbar.shadowRoot.querySelector('#loadUnpacked');
                    if (!loadUnpackedButton) return 'No load unpacked button found';
                    
                    // Note: We can't actually trigger the file dialog programmatically
                    // But we can highlight the button for the user
                    loadUnpackedButton.style.backgroundColor = '#ff0000';
                    loadUnpackedButton.style.animation = 'pulse 1s infinite';
                    
                    return 'Load unpacked button highlighted - manual action required';
                })()
            `,
            awaitPromise: true
        }, sessionId);
        
        console.log('Load unpacked result:', loadUnpacked.result.value);
        
        // Add CSS for pulse animation
        await client.send('Runtime.evaluate', {
            expression: `
                const style = document.createElement('style');
                style.textContent = \`
                    @keyframes pulse {
                        0% { transform: scale(1); }
                        50% { transform: scale(1.1); }
                        100% { transform: scale(1); }
                    }
                \`;
                document.head.appendChild(style);
            `
        }, sessionId);
        
        console.log('\n✅ Developer mode enabled!');
        console.log('⚠️  Manual step required:');
        console.log('   1. Look for the RED pulsing "Load unpacked" button');
        console.log('   2. Click it and select: ' + path.resolve('./extension/dist'));
        console.log('\nAfter loading, run: npm run smoke');
        
    } catch (err) {
        console.error('Error:', err);
    } finally {
        if (client) {
            await client.close();
        }
    }
}

loadExtension().catch(console.error);