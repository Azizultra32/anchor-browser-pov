import CDP from 'chrome-remote-interface';

async function monitorExtension() {
    console.log('Monitoring for extension load...');
    console.log('Please click the RED pulsing "Load unpacked" button in Chrome');
    console.log('and select: /Users/ali/Downloads/anchor-browser-poc/extension/dist\n');
    
    let found = false;
    let attempts = 0;
    
    while (!found && attempts < 120) { // 2 minutes max
        try {
            const client = await CDP({port: 9222});
            const {Target} = client;
            
            // Get all targets
            const targets = await Target.getTargets();
            
            // Look for extension pages
            const extensionTarget = targets.targetInfos.find(t => 
                t.url && t.url.includes('chrome-extension://')
            );
            
            if (extensionTarget) {
                found = true;
                console.log('\n✅ Extension detected!');
                console.log('Extension URL:', extensionTarget.url);
                console.log('\nRunning smoke test...\n');
                
                await client.close();
                
                // Automatically run smoke test
                const { exec } = await import('child_process');
                const { promisify } = await import('util');
                const execAsync = promisify(exec);
                
                try {
                    const { stdout, stderr } = await execAsync('npm run smoke');
                    console.log(stdout);
                    if (stderr) console.error(stderr);
                } catch (error) {
                    console.error('Smoke test failed:', error.message);
                }
                
                break;
            }
            
            await client.close();
            
        } catch (err) {
            // Ignore connection errors
        }
        
        if (!found) {
            process.stdout.write('.');
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
        }
    }
    
    if (!found) {
        console.log('\n\n❌ Timeout: Extension not detected after 2 minutes');
        console.log('Please manually load the extension and run: npm run smoke');
    }
}

monitorExtension().catch(console.error);