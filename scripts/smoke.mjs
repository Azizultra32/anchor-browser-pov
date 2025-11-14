#!/usr/bin/env node

import { spawn } from 'child_process'
import CDP from 'chrome-remote-interface'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..'
const PORT = Number(process.env.MCP_DEBUG_PORT || 9222)
const DEMO_URL = 'http://localhost:8788/ehr.html'

async function runBuild() {
  console.log('Building extension...')
  await runCommand('npm', ['run', 'build'], { cwd: path.join(ROOT, 'extension') })
}

async function runSmoke() {
  const { client, target } = await openPage(DEMO_URL)
  const summary = { toggle: false, overlay: false, values: null, logs: [] }
  try {
    summary.toggle = await ensureToggle(client)
    await clickToggle(client)
    summary.overlay = await ensureOverlay(client)
    await clickButton(client, 'btnMap')
    await delay(300)
    await clickButton(client, 'btnSend')
    await delay(300)
    await clickButton(client, 'btnFill')
    await delay(500)
    summary.values = await readValues(client)
    summary.logs = await readOverlayLogs(client)
    console.log('SMOKE PASS', JSON.stringify(summary, null, 2))
  } finally {
    await client.close()
    await CDP.Close({ port: PORT, id: target.id })
  }
}

async function openPage(url) {
  const target = await CDP.New({ port: PORT, url: 'about:blank' })
  const client = await CDP({ port: PORT, target })
  const { Page } = client
  await Page.enable()
  await Page.navigate({ url })
  await Page.loadEventFired()
  await delay(500)
  return { client, target }
}

async function ensureToggle(client) {
  const { Runtime } = client
  const { result } = await Runtime.evaluate({
    expression: `(() => {
      return !!document.getElementById('__anchor_ghost_toggle__')
    })()`,
    returnByValue: true
  })
  if (!result.value) {
    throw new Error('Toggle button not found on demo page')
  }
  return true
}

async function clickToggle(client) {
  const { Runtime } = client
  await Runtime.evaluate({
    expression: `(() => {
      const btn = document.getElementById('__anchor_ghost_toggle__')
      if (!btn) throw new Error('Toggle button missing when attempting click')
      btn.click()
      return true
    })()`,
    returnByValue: true
  })
  await delay(300)
}

async function ensureOverlay(client) {
  const { Runtime } = client
  const { result } = await Runtime.evaluate({
    expression: `!!document.getElementById('__anchor_ghost_overlay__')`,
    returnByValue: true
  })
  if (!result.value) {
    throw new Error('Overlay failed to appear after clicking toggle')
  }
  return true
}

async function clickButton(client, id) {
  const { Runtime } = client
  await Runtime.evaluate({
    expression: `(() => {
      const host = document.getElementById('__anchor_ghost_overlay__')
      if (!host || !host.shadowRoot) throw new Error('Overlay host missing')
      const btn = host.shadowRoot.getElementById('${id}')
      if (!btn) throw new Error('Button ${id} missing')
      btn.click()
      return true
    })()`,
    returnByValue: true
  })
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
  return result.value
}

async function readOverlayLogs(client) {
  const { Runtime } = client
  const { result } = await Runtime.evaluate({
    expression: `(() => {
      const host = document.getElementById('__anchor_ghost_overlay__')
      if (!host || !host.shadowRoot) return []
      const entries = host.shadowRoot.getElementById('log')
      if (!entries) return []
      return Array.from(entries.children).map(el => el.textContent || '')
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

await runBuild()
await runSmoke()

