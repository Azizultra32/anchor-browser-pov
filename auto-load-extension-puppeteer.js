import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function loadExtension() {
  console.log('Connecting to Chrome...');
  const browser = await puppeteer.connect({
    browserURL: 'http://localhost:9222',
    defaultViewport: null
  });

  const pages = await browser.pages();
  let page = pages.find(p => p.url().includes('chrome://extensions'));
  
  if (!page) {
    console.log('Opening extensions page...');
    page = await browser.newPage();
    await page.goto('chrome://extensions');
    await page.waitForTimeout(1000);
  }

  console.log('Enabling developer mode...');
  
  // Try to click developer mode toggle
  try {
    await page.evaluate(() => {
      const devModeToggle = document.querySelector('extensions-manager')
        ?.shadowRoot?.querySelector('extensions-toolbar')
        ?.shadowRoot?.querySelector('#devMode');
      
      if (devModeToggle && !devModeToggle.checked) {
        devModeToggle.click();
      }
    });
  } catch (e) {
    console.log('Developer mode might already be enabled');
  }

  await page.waitForTimeout(500);

  console.log('Loading extension...');
  
  // Find and click Load unpacked button
  const loaded = await page.evaluate(() => {
    const toolbar = document.querySelector('extensions-manager')
      ?.shadowRoot?.querySelector('extensions-toolbar')
      ?.shadowRoot;
    
    const loadButton = toolbar?.querySelector('#loadUnpacked');
    if (loadButton) {
      loadButton.click();
      return true;
    }
    return false;
  });

  if (loaded) {
    console.log('Clicked Load unpacked button');
    console.log('File dialog opened - Chrome security prevents automated selection');
    console.log('Extension directory: ' + resolve(__dirname, 'extension/dist'));
    
    // Wait a bit then check if extension loaded
    await page.waitForTimeout(10000);
    
    const extensionLoaded = await page.evaluate(() => {
      const items = document.querySelector('extensions-manager')
        ?.shadowRoot?.querySelectorAll('extensions-item');
      
      let found = false;
      items?.forEach(item => {
        const name = item.shadowRoot?.querySelector('#name-and-version')?.textContent;
        if (name?.includes('Anchor Ghost Overlay')) {
          found = true;
        }
      });
      return found;
    });
    
    if (extensionLoaded) {
      console.log('✅ Extension loaded successfully!');
    } else {
      console.log('⚠️ Extension not detected after 10 seconds');
    }
  }

  await browser.disconnect();
}

loadExtension().catch(console.error);