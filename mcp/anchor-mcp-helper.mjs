#!/usr/bin/env node

/**
 * Anchor Browser POC - MCP Helper
 * Uses event bridge to work with Chrome MV3 isolated worlds
 */

import CDP from 'chrome-remote-interface'

const DEVTOOLS_PORT = Number(process.env.MCP_DEVTOOLS_PORT || 9222)
const AGENT_BASE = process.env.MCP_AGENT_BASE || 'http://localhost:8787'
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function connectCDP() {
  try {
    return await CDP({ port: DEVTOOLS_PORT })
  } catch (err) {
    throw new Error(`Failed to connect to Chrome on port ${DEVTOOLS_PORT}. Is Chrome running with --remote-debugging-port=${DEVTOOLS_PORT}?`)
  }
}

async function getOrCreatePage(client) {
  const { Target } = client
  const { targetInfos } = await Target.getTargets()
  const existing = targetInfos.find(t => t.type === 'page' && !t.attached)
  if (existing) return existing.targetId

  const created = await Target.createTarget({ url: 'about:blank' })
  return created.targetId
}

async function navigate(client, targetId, url) {
  const { Target, Page } = client
  await Target.attachToTarget({ targetId, flatten: true })
  await Page.enable()
  await Page.navigate({ url })
  await Page.loadEventFired()
}

async function evalInPage(client, expression, awaitPromise = false) {
  const { Runtime } = client
  const result = await Runtime.evaluate({
    expression,
    awaitPromise,
    returnByValue: true
  })

  if (result.exceptionDetails) {
    const { text, exception } = result.exceptionDetails
    throw new Error(`Runtime error: ${text || exception?.description || 'unknown'}`)
  }

  return result.result?.value
}

/**
 * Trigger MCP bridge event and wait for response
 */
async function triggerMCPEvent(client, requestEvent, responseEvent, timeoutMs = 3000) {
  const script = `
    (async () => {
      return new Promise((resolve) => {
        const handler = (e) => {
          window.removeEventListener('${responseEvent}', handler)
          resolve(e.detail)
        }
        window.addEventListener('${responseEvent}', handler)
        window.dispatchEvent(new Event('${requestEvent}'))

        setTimeout(() => resolve({ error: 'Timeout waiting for ${responseEvent}' }), ${timeoutMs})
      })
    })()
  `

  return evalInPage(client, script, true)
}

/**
 * Fetch DOM map from agent
 */
async function fetchDomFromAgent() {
  const res = await fetch(`${AGENT_BASE}/dom`)
  if (!res.ok) throw new Error(`Agent /dom failed: ${res.status}`)
  return res.json()
}

/**
 * Tool: anchor_map_page
 */
async function toolAnchorMapPage(url) {
  if (!url) throw new Error('anchor_map_page requires a url argument')

  const client = await connectCDP()
  try {
    const targetId = await getOrCreatePage(client)
    await navigate(client, targetId, url)

    console.error('Waiting for content script...')
    await sleep(1500) // Wait for extension to inject

    console.error('Triggering map via MCP bridge...')
    const mapResult = await triggerMCPEvent(client, '__ANCHOR_MCP_MAP_REQUEST__', '__ANCHOR_MCP_MAP_RESPONSE__')

    if (mapResult.error) {
      throw new Error(mapResult.error)
    }

    console.error('Map triggered, fetching from agent...')
    await sleep(1000) // Wait for map to send to agent

    const dom = await fetchDomFromAgent()

    return {
      success: true,
      url: dom.url || url,
      fields: dom.fields || [],
      fieldCount: dom.fields?.length || 0,
      capturedAt: dom.capturedAt || new Date().toISOString(),
      method: 'mcp_bridge'
    }
  } finally {
    await client.close()
  }
}

/**
 * Tool: anchor_send_map
 */
async function toolAnchorSendMap() {
  const client = await connectCDP()
  try {
    console.error('Triggering send map via MCP bridge...')
    const result = await triggerMCPEvent(client, '__ANCHOR_MCP_SEND_REQUEST__', '__ANCHOR_MCP_SEND_RESPONSE__')

    if (result.error) {
      throw new Error(result.error)
    }

    await sleep(500)
    const dom = await fetchDomFromAgent()

    return {
      success: true,
      sent: true,
      fieldCount: dom.fields?.length || 0
    }
  } finally {
    await client.close()
  }
}

/**
 * Tool: anchor_fill_demo
 */
async function toolAnchorFillDemo() {
  const client = await connectCDP()
  try {
    console.error('Triggering fill via MCP bridge...')
    const result = await triggerMCPEvent(client, '__ANCHOR_MCP_FILL_REQUEST__', '__ANCHOR_MCP_FILL_RESPONSE__')

    if (result.error) {
      throw new Error(result.error)
    }

    return {
      success: true,
      filled: true
    }
  } finally {
    await client.close()
  }
}

/**
 * Main CLI
 */
async function main() {
  const [,, tool, ...args] = process.argv

  if (!tool || tool === '-h' || tool === '--help') {
    console.log(`Anchor Browser POC - MCP Helper

Usage:
  node mcp/anchor-mcp-helper.mjs anchor_map_page <url>
  node mcp/anchor-mcp-helper.mjs anchor_send_map
  node mcp/anchor-mcp-helper.mjs anchor_fill_demo

Examples:
  node mcp/anchor-mcp-helper.mjs anchor_map_page "http://localhost:8788/ehr.html"
  node mcp/anchor-mcp-helper.mjs anchor_send_map
  node mcp/anchor-mcp-helper.mjs anchor_fill_demo
`)
    process.exit(0)
  }

  try {
    let result

    if (tool === 'anchor_map_page') {
      const url = args[0]
      result = await toolAnchorMapPage(url)
    } else if (tool === 'anchor_send_map') {
      result = await toolAnchorSendMap()
    } else if (tool === 'anchor_fill_demo') {
      result = await toolAnchorFillDemo()
    } else {
      throw new Error(`Unknown tool: ${tool}`)
    }

    console.log(JSON.stringify(result, null, 2))
  } catch (err) {
    console.error('[Anchor MCP Helper] Error:', err?.message || err)
    process.exit(1)
  }
}

main()
