import CDP from 'chrome-remote-interface'
import { writeFileSync } from 'fs'

const PORT = Number(process.env.MCP_DEBUG_PORT || 9222)
const DEMO_URL = 'http://localhost:8788/ehr.html'
const SIMPLE_URL = 'http://localhost:8788/simple.html'

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function createClient() {
  const target = await CDP.New({ port: PORT, url: 'about:blank' })
  const client = await CDP({ port: PORT, target })
  const { Page, Runtime, Log } = client
  await Promise.all([Page.enable(), Runtime.enable(), Log.enable()])
  return { client, target }
}

async function navigate(client, url) {
  await client.Page.navigate({ url })
  await client.Page.loadEventFired()
}

async function closeTarget(target) {
  try {
    await CDP.Close({ port: PORT, id: target.id })
  } catch { }
}

function hookLogs(client) {
  const logs = []
  client.Runtime.on('consoleAPICalled', ({ type, args }) => {
    const text = args.map(a => a.value ?? a.description ?? '').join(' ')
    logs.push({ type, text })
  })
  client.Log.on('entryAdded', ({ entry }) => {
    logs.push({ type: entry.level, text: entry.text })
  })
  return logs
}

async function ensureOverlay(client) {
  const { result } = await client.Runtime.evaluate({
    expression: `(() => !!document.getElementById('__anchor_ghost_overlay__'))()`,
    returnByValue: true
  })
  return result.value
}

async function toggleViaButton(client) {
  await client.Runtime.evaluate({
    expression: `(() => {
      const btn = document.getElementById('__anchor_ghost_toggle__');
      if (!btn) throw new Error('toggle button missing');
      btn.click();
      return true;
    })()`
  })
}

async function clickButton(client, id) {
  const expr = `(() => {
    const host = document.getElementById('__anchor_ghost_overlay__');
    if (!host || !host.shadowRoot) throw new Error('overlay missing');
    const btn = host.shadowRoot.getElementById('${id}');
    if (!btn) throw new Error('button ${id} not found');
    btn.click();
    return true;
  })()`
  await client.Runtime.evaluate({ expression: expr })
}

async function runDemo() {
  const { client, target } = await createClient()
  const logs = hookLogs(client)
  await navigate(client, DEMO_URL)
  await delay(500)
  await toggleViaButton(client)
  await delay(300)
  const overlayPresent = await ensureOverlay(client)
  if (!overlayPresent) throw new Error('Overlay failed to appear on demo page')
  await clickButton(client, 'btnMap')
  await delay(300)
  await clickButton(client, 'btnSend')
  await delay(300)
  await clickButton(client, 'btnFill')
  await delay(500)
  const screenshot = await client.Page.captureScreenshot({ format: 'png' })
  writeFileSync('/Users/ali/Downloads/anchor-browser-poc/demo-overlay.png', Buffer.from(screenshot.data, 'base64'))
  const hasLog = logs.some(l => l.text.includes('[AnchorGhost] Content script loaded on:'))
  await client.close()
  await closeTarget(target)
  return { hasLog, logs }
}

async function runSimple() {
  const { client, target } = await createClient()
  const logs = hookLogs(client)
  await navigate(client, SIMPLE_URL)
  await delay(300)
  await toggleViaButton(client)
  await delay(300)
  const overlayPresent = await ensureOverlay(client)
  await client.close()
  await closeTarget(target)
  return { hasLog: logs.some(l => l.text.includes('[AnchorGhost] Content script loaded on:')), overlayPresent }
}

async function main() {
  const demo = await runDemo()
  const simple = await runSimple()
  console.log(JSON.stringify({ demoLogObserved: demo.hasLog, simpleLogObserved: simple.hasLog, simpleOverlay: simple.overlayPresent, demoTailLogs: demo.logs.slice(-6) }, null, 2))
}

main().catch(err => {
  console.error('SMOKE_FAIL', err)
  process.exitCode = 1
})
