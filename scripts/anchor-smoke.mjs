#!/usr/bin/env node

import { spawn } from 'child_process'
import CDP from 'chrome-remote-interface'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..'
const PORT = Number(process.env.MCP_DEBUG_PORT || 9222)
const DEMO_URL = 'http://localhost:8788/ehr.html'
const AGENT_URL = 'http://localhost:8787/'

// Colors
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const NC = '\x1b[0m'

async function main() {
  console.log(`${YELLOW}=== Anchor Browser POC Smoke Test ===${NC}\n`)
  
  try {
    // Pre-flight checks
    await checkServices()
    
    // Build extension
    await runBuild()
    
    // Run smoke test
    await runSmoke()
    
    console.log(`\n${GREEN}=== SMOKE TEST PASSED ===${NC}`)
    process.exit(0)
  } catch (err) {
    console.error(`\n${RED}=== SMOKE TEST FAILED ===${NC}`)
    console.error(`${RED}Error: ${err.message}${NC}`)
    if (err.detail) {
      console.error(`Detail: ${err.detail}`)
    }
    process.exit(1)
  }
}

async function checkServices() {
  console.log('Checking services...')
  
  // Check Chrome
  try {
    const res = await fetch(`http://localhost:${PORT}/json/version`)
    if (!res.ok) throw new Error('Chrome DevTools not responding')
    console.log('  Chrome DevTools: ✓')
  } catch (err) {
    const error = new Error('Chrome not running on port ' + PORT)
    error.detail = 'Run: ./anchor-start.sh'
    throw error
  }
  
  // Check Agent
  try {
    const res = await fetch(AGENT_URL)
    if (!res.ok) throw new Error('Agent not responding')
    console.log('  Agent: ✓')
  } catch (err) {
    const error = new Error('Agent not running on port 8787')
    error.detail = 'Run: ./anchor-start.sh'
    throw error
  }
  
  // Check Demo
  try {
    const res = await fetch(DEMO_URL)
    if (!res.ok) throw new Error('Demo server not responding')
    console.log('  Demo Server: ✓')
  } catch (err) {
    const error = new Error('Demo server not running on port 8788')
    error.detail = 'Run: ./anchor-start.sh'
    throw error
  }
}

async function runBuild() {
  console.log('\nBuilding extension...')
  await runCommand('npm', ['run', 'build'], { cwd: path.join(ROOT, 'extension') })
  console.log('  Build: ✓')
}

async function runSmoke() {
  console.log('\nRunning smoke test...')
  
  const { client, target } = await openPage(DEMO_URL)
  const results = {
    toggle: false,
    overlay: false,
    mapped: false,
    sent: false,
    filled: false,
    values: {},
    logs: []
  }
  
  try {
    // Check for toggle button
    results.toggle = await checkToggleExists(client)
    console.log('  Toggle button: ✓')
    
    // Click toggle to show overlay
    await clickToggle(client)
    results.overlay = await checkOverlayExists(client)
    console.log('  Overlay appears: ✓')
    
    // Map fields
    await clickButton(client, 'btnMap')
    await delay(500)
    results.mapped = await checkLogContains(client, 'Mapped')
    console.log('  Map fields: ✓')
    
    // Send to agent
    await clickButton(client, 'btnSend')
    await delay(500)
    results.sent = await checkLogContains(client, 'Agent /dom response')
    console.log('  Send to agent: ✓')
    
    // Fill demo
    await clickButton(client, 'btnFill')
    await delay(800)
    results.filled = await checkLogContains(client, 'Agent plan')
    console.log('  Fill demo: ✓')
    
    // Read final values
    results.values = await readValues(client)
    results.logs = await readOverlayLogs(client)
    
    // Validate at least one field was filled
    const filledCount = Object.values(results.values).filter(v => v && v.length > 0).length
    if (filledCount === 0) {
      throw new Error('No fields were filled')
    }
    console.log(`  Fields filled: ✓ (${filledCount} fields)`)
    
  } finally {
    await client.close()
    await CDP.Close({ port: PORT, id: target.id })
  }
  
  return results
}

async function openPage(url) {
  const target = await CDP.New({ port: PORT, url: 'about:blank' })
  const client = await CDP({ port: PORT, target })
  const { Page, Runtime } = client
  await Page.enable()
  await Runtime.enable()
  await Page.navigate({ url })
  await Page.loadEventFired()
  await delay(1000) // Give content script time to inject
  return { client, target }
}

async function checkToggleExists(client) {
  const { Runtime } = client
  const { result } = await Runtime.evaluate({
    expression: `!!document.getElementById('__anchor_ghost_toggle__')`,
    returnByValue: true
  })
  if (!result.value) {
    throw new Error('Toggle button not found - content script may not be injected')
  }
  return true
}

async function checkOverlayExists(client) {
  const { Runtime } = client
  const { result } = await Runtime.evaluate({
    expression: `!!document.getElementById('__anchor_ghost_overlay__')`,
    returnByValue: true
  })
  if (!result.value) {
    throw new Error('Overlay not found after clicking toggle')
  }
  return true
}

async function clickToggle(client) {
  const { Runtime } = client
  await Runtime.evaluate({
    expression: `(() => {
      const btn = document.getElementById('__anchor_ghost_toggle__')
      if (!btn) throw new Error('Toggle button missing')
      btn.click()
    })()`
  })
  await delay(300)
}

async function clickButton(client, id) {
  const { Runtime } = client
  const { result, exceptionDetails } = await Runtime.evaluate({
    expression: `(() => {
      const host = document.getElementById('__anchor_ghost_overlay__')
      if (!host || !host.shadowRoot) throw new Error('Overlay not ready')
      const btn = host.shadowRoot.getElementById('${id}')
      if (!btn) throw new Error('Button ${id} not found')
      btn.click()
      return true
    })()`
  })
  if (exceptionDetails) {
    throw new Error(`Failed to click ${id}: ${exceptionDetails.text || exceptionDetails.exception.description}`)
  }
}

async function checkLogContains(client, text) {
  const logs = await readOverlayLogs(client)
  return logs.some(log => log.includes(text))
}

async function readValues(client) {
  const { Runtime } = client
  const { result } = await Runtime.evaluate({
    expression: `({
      name: document.querySelector('#pt_name')?.value || '',
      dob: document.querySelector('#dob')?.value || '',
      cc: document.querySelector('#cc')?.value || ''
    })`,
    returnByValue: true
  })
  return result.value || {}
}

async function readOverlayLogs(client) {
  const { Runtime } = client
  const { result } = await Runtime.evaluate({
    expression: `(() => {
      const host = document.getElementById('__anchor_ghost_overlay__')
      if (!host || !host.shadowRoot) return []
      const logEl = host.shadowRoot.getElementById('log')
      if (!logEl) return []
      return Array.from(logEl.children).map(el => el.textContent || '')
    })()`,
    returnByValue: true
  })
  return result.value || []
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function runCommand(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...opts })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} ${args.join(' ')} exited with ${code}`))
    })
  })
}

// Run
await main()