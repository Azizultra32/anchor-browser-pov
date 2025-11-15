#!/usr/bin/env node

import CDP from 'chrome-remote-interface'

const DEVTOOLS_HOST = process.env.MCP_DEVTOOLS_HOST || 'localhost'
const DEVTOOLS_PORT = Number(process.env.MCP_DEVTOOLS_PORT || 9222)
const AGENT_BASE = process.env.MCP_AGENT_BASE || 'http://localhost:8787'

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

function assertFetchAvailable () {
  if (typeof fetch !== 'function') {
    throw new Error('Global fetch is unavailable in this Node runtime. Use Node 18+ or polyfill.')
  }
}

async function connectCDP () {
  return CDP({ host: DEVTOOLS_HOST, port: DEVTOOLS_PORT })
}

async function getOrCreatePage (client) {
  const { Target } = client
  const { targetInfos } = await Target.getTargets()
  const existing = targetInfos.find(t => t.type === 'page' && t.attached === false)
  if (existing) return existing.targetId
  const created = await Target.createTarget({ url: 'about:blank' })
  return created.targetId
}

async function navigate (client, targetId, url) {
  const { Target, Page } = client
  await Target.attachToTarget({ targetId, flatten: true })
  await Page.enable()
  await Page.navigate({ url })
  await Page.loadEventFired()
}

async function evalInPage (client, expression) {
  const { Runtime } = client
  const result = await Runtime.evaluate({ expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) {
    const { text, exception } = result.exceptionDetails
    throw new Error(`Runtime error: ${text || exception?.description || 'unknown'}`)
  }
  return result.result?.value
}

async function collectDomSnapshot (client) {
  const script = `(() => {
    const nodes = Array.from(document.querySelectorAll('input, textarea, select, [contenteditable="true"]'))
    const cssEscape = CSS && CSS.escape ? CSS.escape : (s) => s

    const uniqueSelector = (el) => {
      if (el.id) return '#' + cssEscape(el.id)
      const parts = []
      let node = el
      while (node && node.nodeType === 1 && parts.length < 5) {
        let selector = node.nodeName.toLowerCase()
        const parent = node.parentElement
        if (parent) {
          const siblings = Array.from(parent.children).filter(child => child.nodeName === node.nodeName)
          if (siblings.length > 1) {
            selector += ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')'
          }
        }
        parts.unshift(selector)
        node = parent
      }
      return parts.join(' > ')
    }

    const isVisible = (el) => {
      const rect = el.getBoundingClientRect()
      const style = window.getComputedStyle(el)
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
    }

    const labelFor = (el) => {
      const aria = el.getAttribute('aria-label')
      if (aria) return aria
      if (el.id) {
        const match = document.querySelector('label[for="' + CSS.escape(el.id) + '"]')
        if (match) return match.textContent?.trim() || ''
      }
      const closestLabel = el.closest('label')
      if (closestLabel) return closestLabel.textContent?.trim() || ''
      if (el.getAttribute('placeholder')) return el.getAttribute('placeholder')
      if (el.getAttribute('name')) return el.getAttribute('name')
      return el.id || el.className || el.tagName.toLowerCase()
    }

    const roleFor = (el) => {
      if (el.getAttribute('role')) return el.getAttribute('role')
      const tag = el.tagName.toLowerCase()
      if (tag === 'textarea') return 'textarea'
      if (tag === 'select') return 'combobox'
      if (tag === 'input') return el.getAttribute('type') || 'textbox'
      if (el.isContentEditable) return 'textbox'
      return tag
    }

    const editable = (el) => {
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        return !el.disabled && !el.readOnly
      }
      return el.isContentEditable
    }

    return nodes
      .filter(isVisible)
      .map(el => ({
        selector: uniqueSelector(el),
        label: labelFor(el) || '(unlabeled)',
        role: roleFor(el),
        editable: editable(el),
        visible: true
      }))
  })();`
  return evalInPage(client, script)
}

async function fetchDom (retries = 10, delayMs = 500) {
  assertFetchAvailable()
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(`${AGENT_BASE}/dom`)
    if (res.ok) {
      return res.json()
    }
    await sleep(delayMs)
  }
  throw new Error('Agent /dom failed after retries')
}

async function requestPlan ({ url, fields, note, mode }) {
  assertFetchAvailable()
  const body = { url, fields, note, mode }
  const res = await fetch(`${AGENT_BASE}/actions/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const json = await res.json()
  if (json && json.error) {
    throw new Error(`Agent plan error: ${json.error}`)
  }
  return json
}

async function postDomMap ({ url, fields }) {
  assertFetchAvailable()
  const res = await fetch(`${AGENT_BASE}/dom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, fields })
  })
  if (!res.ok) {
    throw new Error(`Agent /dom POST failed (${res.status})`)
  }
  return res.json()
}

async function toolAnchorMapPage (url) {
  if (!url) throw new Error('anchor_map_page requires a url argument')
  const client = await connectCDP()
  try {
    const targetId = await getOrCreatePage(client)
    await navigate(client, targetId, url)
    await sleep(500) // Give content script time to inject
    
    // First try to trigger the map via the Ghost overlay button
    const triggerScript = `
      (() => {
        // Look for Ghost button and click it to open overlay
        const ghostButton = document.querySelector('[data-anchor-ghost-button]') ||
                           document.querySelector('button.ghost-toggle');
        if (ghostButton) {
          ghostButton.click();
          console.log('Clicked Ghost button');
        }
        
        // Wait a bit then try to click Map button in shadow DOM
        setTimeout(() => {
          const host = document.getElementById('__anchor_ghost_overlay__');
          if (host && host.shadowRoot) {
            const mapBtn = Array.from(host.shadowRoot.querySelectorAll('button'))
              .find(b => b.textContent.includes('Map'));
            if (mapBtn) {
              mapBtn.click();
              console.log('Clicked Map button');
            }
          }
        }, 300);
        
        return 'triggered';
      })();
    `;
    
    await evalInPage(client, triggerScript);
    await sleep(1000); // Wait for map to complete and send to agent
    
    // Try to fetch the DOM from the agent
    try {
      const dom = await fetchDom()
      return { mapStatus: 'triggered_via_ui', dom }
    } catch (err) {
      // If agent doesn't have the map yet, collect DOM directly as fallback
      console.log('[Anchor MCP] Agent fetch failed, using direct collection')
      const fields = await collectDomSnapshot(client)
      if (!Array.isArray(fields) || !fields.length) {
        throw new Error('DOM snapshot returned no candidate fields')
      }
      await postDomMap({ url, fields })
      await sleep(400)
      const dom = await fetchDom()
      return { mapStatus: 'dom_snapshot_fallback', dom }
    }
  } finally {
    client.close()
  }
}

async function toolAnchorPlanFill (url, note = 'Generated via MCP') {
  if (!url) throw new Error('anchor_plan_fill requires a url argument')
  const dom = await fetchDom()
  const plan = await requestPlan({
    url,
    fields: dom.fields || [],
    note,
    mode: 'mcp'
  })
  return {
    domSummary: { url: dom.url, fields: dom.fields ? dom.fields.length : 0 },
    plan
  }
}

async function main () {
  const [,, tool, ...args] = process.argv
  if (!tool || tool === '-h' || tool === '--help') {
    console.log(`Anchor MCP helper\n\nUsage:\n  node mcp/anchor-server.mjs anchor_map_page <url>\n  node mcp/anchor-server.mjs anchor_plan_fill <url> [note]\n`)
    process.exit(0)
  }

  try {
    if (tool === 'anchor_map_page') {
      const url = args[0]
      const result = await toolAnchorMapPage(url)
      console.log(JSON.stringify(result, null, 2))
      return
    }
    if (tool === 'anchor_plan_fill') {
      const url = args[0]
      const note = args[1]
      const result = await toolAnchorPlanFill(url, note)
      console.log(JSON.stringify(result, null, 2))
      return
    }
    throw new Error(`Unknown tool: ${tool}`)
  } catch (err) {
    console.error('[Anchor MCP] Error:', err?.message || err)
    process.exit(1)
  }
}

main()
