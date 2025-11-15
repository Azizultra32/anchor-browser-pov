import CDP from 'chrome-remote-interface';

async function checkToggle() {
  try {
    const client = await CDP({ port: 9222 });
    const { Runtime, Page, Target } = client;
    
    // Get all targets
    const targets = await Target.getTargets();
    console.log('Found targets:', targets.targetInfos.length);
    
    // Find the demo page
    const demoTarget = targets.targetInfos.find(t => 
      t.url.includes('localhost:8788/ehr.html')
    );
    
    if (!demoTarget) {
      console.log('Demo page not found. Opening it...');
      await Target.createTarget({ url: 'http://localhost:8788/ehr.html' });
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Enable Runtime and Page
    await Runtime.enable();
    await Page.enable();
    
    // Check for toggle button
    const result = await Runtime.evaluate({
      expression: `
        (() => {
          const toggle = document.querySelector('#anchor-toggle');
          const overlay = document.querySelector('#anchor-overlay');
          return {
            hasToggle: !!toggle,
            toggleId: toggle?.id,
            hasOverlay: !!overlay,
            contentScriptMarker: !!window.__ANCHOR_GHOST__,
            documentReady: document.readyState
          };
        })()
      `,
      returnByValue: true
    });
    
    console.log('Toggle check result:', result.result.value);
    
    await client.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkToggle();