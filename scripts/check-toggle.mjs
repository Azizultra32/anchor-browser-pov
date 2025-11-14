#!/usr/bin/env node

import CDP from 'chrome-remote-interface'

const PORT = Number(process.env.MCP_DEBUG_PORT || 9222)
const DEMO_URL = 'http://localhost:8788/ehr.html'
const ATTEMPTS = Number(process.env.TOGGLE_ATTEMPTS || 80)

async function main() {
  const { client, target } = await openPage(DEMO_URL)
  try {
    const ok = await waitForToggle(client)
    if (!ok) {
      throw new Error('Toggle button not found on demo page')
    }
  } finally {
    await client.close().catch(() => {})
    await CDP.Close({ port: PORT, id: target.id }).catch(() => {})
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

async function waitForToggle(client) {
  const { Runtime } = client
  for (let i = 0; i < ATTEMPTS; i++) {
    const { result } = await Runtime.evaluate({
      expression: `!!document.getElementById('__anchor_ghost_toggle__')`,
      returnByValue: true
    })
    if (result.value) return true
    await delay(250)
  }
  return false
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
