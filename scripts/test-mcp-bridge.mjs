#!/usr/bin/env node

import CDP from 'chrome-remote-interface'

const PORT = 9222
const DEMO_URL = 'http://localhost:8788/ehr.html'

console.log('Testing MCP bridge...')

try {
  // Connect to Chrome
  const client = await CDP({ port: PORT })
  const { Page, Runtime } = client
  
  await Page.enable()
  await Runtime.enable()
  
  // Navigate to demo page
  console.log('Navigating to demo page...')
  await Page.navigate({ url: DEMO_URL })
  await Page.loadEventFired()
  
  // Wait for content script
  await new Promise(r => setTimeout(r, 1000))
  
  // Test MCP map event
  console.log('Testing MCP map event...')
  const mapResult = await Runtime.evaluate({
    expression: `
      new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ error: 'Timeout - MCP bridge not responding' })
        }, 2000)
        
        const handler = (e) => {
          clearTimeout(timeout)
          window.removeEventListener('__ANCHOR_MCP_MAP_RESPONSE__', handler)
          resolve(e.detail)
        }
        
        window.addEventListener('__ANCHOR_MCP_MAP_RESPONSE__', handler)
        window.dispatchEvent(new Event('__ANCHOR_MCP_MAP_REQUEST__'))
      })
    `,
    awaitPromise: true,
    returnByValue: true
  })
  
  if (mapResult.result?.value?.error) {
    console.error('MCP bridge error:', mapResult.result.value.error)
    process.exit(1)
  }
  
  const fields = mapResult.result?.value?.fields || []
  console.log(`MCP bridge working! Found ${fields.length} fields`)
  
  if (fields.length > 0) {
    console.log('Sample fields:')
    fields.slice(0, 3).forEach(f => {
      console.log(`  - ${f.label} (${f.selector})`)
    })
  }
  
  await client.close()
  process.exit(0)
  
} catch (err) {
  console.error('Error:', err.message)
  console.error('\nMake sure:')
  console.error('1. Chrome is running: ./anchor-start.sh')
  console.error('2. Extension is loaded (check chrome://extensions)')
  console.error('3. Demo page is accessible')
  process.exit(1)
}