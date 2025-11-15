import CDP from 'chrome-remote-interface';

async function findExtension() {
  try {
    const client = await CDP({ port: 9222 });
    const { Runtime, Target } = client;
    
    // Create extensions page
    await Target.createTarget({ url: 'chrome://extensions' });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get all targets again
    const targets = await Target.getTargets();
    const extTarget = targets.targetInfos.find(t => 
      t.url === 'chrome://extensions/'
    );
    
    if (extTarget) {
      // Attach to extensions page
      await Target.attachToTarget({ targetId: extTarget.targetId, flatten: true });
      await Runtime.enable();
      
      // Try to find our extension
      const result = await Runtime.evaluate({
        expression: `
          (() => {
            const cards = document.querySelectorAll('extensions-item');
            const extensions = [];
            cards.forEach(card => {
              const name = card.shadowRoot?.querySelector('#name')?.textContent;
              const id = card.getAttribute('id');
              if (name) {
                extensions.push({ name, id });
              }
            });
            return extensions;
          })()
        `,
        returnByValue: true
      });
      
      console.log('Found extensions:', result.result.value);
    }
    
    await client.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

findExtension();