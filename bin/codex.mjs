#!/usr/bin/env node

import { spawn, exec as execCb } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import http from 'node:http'
import { promisify } from 'node:util'
import CDP from 'chrome-remote-interface'
import { Command } from 'commander'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const exec = promisify(execCb)

const ROOT = process.cwd()
const LOGS = resolve(ROOT, 'logs')
const PROFILE = process.env.CODEX_PROFILE || '/tmp/anchor-mcp'
const EXT_DIR = process.env.EXT_DIR || resolve(ROOT, 'extension', 'dist')
const HOST = process.env.CDP_HOST || '127.0.0.1'
const PORT = Number(process.env.CDP_PORT || 9222)
const DEMO_URL = process.env.DEMO_URL || 'http://localhost:8788/ehr.html'
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const program = new Command().name('codex').description('Anchor Codex CLI + MCP helper')

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (err) {
          reject(err)
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(2500, () => {
      req.destroy(new Error('timeout'))
    })
  })
}

async function devtoolsUp() {
  try {
    await httpGetJson(`http://${HOST}:${PORT}/json/version`)
    return true
  } catch {
    return false
  }
}

async function waitForDevtools(timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await devtoolsUp()) return
    await sleep(250)
  }
  throw new Error(`DevTools not reachable on ${HOST}:${PORT}`)
}

function ensureLogs() {
  if (!existsSync(LOGS)) {
    mkdirSync(LOGS, { recursive: true })
  }
}

async function launchChrome() {
  if (!existsSync(CHROME)) {
    throw new Error(`Chrome binary not found. Set CHROME env (current ${CHROME}).`)
  }
  ensureLogs()

  const args = [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--disable-extensions-file-access-check',
    '--allow-file-access-from-files',
    '--allow-insecure-localhost',
    '--disable-web-security',
    '--disable-site-isolation-trials',
    '--no-first-run',
    '--no-default-browser-check'
  ]

  if (existsSync(EXT_DIR)) {
    args.push(`--disable-extensions-except=${EXT_DIR}`)
    args.push(`--load-extension=${EXT_DIR}`)
  }

  const child = spawn(CHROME, args, {
    detached: true,
    stdio: 'ignore'
  })
  child.unref()
  await waitForDevtools()
}

async function chromeEnsure() {
  if (!(await devtoolsUp())) {
    await launchChrome()
  }
}

async function newOrFindDemoTarget() {
  const list = await CDP.List({ host: HOST, port: PORT })
  const found = list.find((entry) => entry.url && entry.url.startsWith(DEMO_URL))
  if (found && found.webSocketDebuggerUrl) {
    return found.webSocketDebuggerUrl
  }
  const created = await CDP.New({ host: HOST, port: PORT, url: DEMO_URL })
  return `ws://${HOST}:${PORT}/devtools/page/${created.id}`
}

async function withDemoClient(fn) {
  await chromeEnsure()
  const ws = await newOrFindDemoTarget()
  const client = await CDP({ target: ws })
  try {
    const { Page, Runtime } = client
    await Page.enable()
    await Runtime.enable()
    await Page.bringToFront()
    return await fn({ Page, Runtime, client })
  } finally {
    await client.close()
  }
}

async function openDemo() {
  await withDemoClient(async ({ Page }) => {
    await Page.navigate({ url: DEMO_URL })
    await Page.loadEventFired()
  })
}

async function status() {
  const chromeStatus = (await devtoolsUp()) ? 'RUNNING' : 'DOWN'
  console.log(`Chrome DevTools (${HOST}:${PORT}): ${chromeStatus}`)
  console.log(`Extension dir: ${existsSync(EXT_DIR) ? EXT_DIR : 'not found'}`)
  console.log(`Profile: ${PROFILE}`)
}

async function killChrome() {
  try {
    await exec(`pkill -f "remote-debugging-port=${PORT}"`)
  } catch {}
  console.log('Chrome kill signal sent.')
}

async function smoke() {
  await chromeEnsure()
  await openDemo()

  const result = await withDemoClient(async ({ Runtime }) => {
    const toggleExists = await Runtime.evaluate({
      expression: "!!document.getElementById('__anchor_ghost_toggle__')",
      returnByValue: true
    })
    if (!toggleExists.result.value) {
      throw new Error('toggle_button_missing')
    }

    await Runtime.evaluate({
      expression: "document.getElementById('__anchor_ghost_toggle__').click(); true;",
      returnByValue: true
    })
    await sleep(200)

    const clickOverlayButton = async (id) => {
      const expr = `(() => {
        const host = document.getElementById('__anchor_ghost_overlay__')
        if (!host || !host.shadowRoot) throw new Error('overlay_missing')
        const btn = host.shadowRoot.getElementById('${id}')
        if (!btn) throw new Error('button_missing:${id}')
        btn.click()
        return true
      })()`
      await Runtime.evaluate({ expression: expr, returnByValue: true })
      await sleep(250)
    }

    await clickOverlayButton('btnMap')
    await clickOverlayButton('btnSend')
    await clickOverlayButton('btnFill')

    const values = await Runtime.evaluate({
      expression: `(() => {
        const snapshot = {}
        const idList = ['pt_name', 'dob', 'cc']
        for (const id of idList) {
          const el = document.getElementById(id)
          snapshot[id] = el ? el.value : null
        }
        return snapshot
      })()`,
      returnByValue: true
    })

    return values.result.value
  })

  console.log(JSON.stringify({ ok: true, values: result }, null, 2))
}

async function mcpServer() {
  await chromeEnsure()

  const server = new McpServer({
    name: 'codex-mcp',
    version: '0.1.0'
  })

  const ok = (data = {}) => ({ ok: true, ...data })

  server.tool(
    'cdp.open',
    {
      description: 'Open a URL inside Chrome (DevTools must be reachable).',
      inputSchema: {
        type: 'object',
        properties: { url: { type: 'string' } },
        required: ['url']
      }
    },
    async ({ input }) => {
      await withDemoClient(async ({ Page }) => {
        await Page.navigate({ url: input.url })
        await Page.loadEventFired()
      })
      return ok({ url: input.url })
    }
  )

  server.tool(
    'cdp.click',
    {
      description: 'Click a DOM element using a CSS selector',
      inputSchema: {
        type: 'object',
        properties: { selector: { type: 'string' } },
        required: ['selector']
      }
    },
    async ({ input }) => {
      await withDemoClient(async ({ Runtime }) => {
        const expr = `(() => {
          const el = document.querySelector(${JSON.stringify(input.selector)})
          if (!el) throw new Error('not_found')
          el.click()
          return true
        })()`
        await Runtime.evaluate({ expression: expr, returnByValue: true })
      })
      return ok()
    }
  )

  server.tool(
    'cdp.type',
    {
      description: 'Set the value of an input or textarea',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string' },
          value: { type: 'string' }
        },
        required: ['selector', 'value']
      }
    },
    async ({ input }) => {
      await withDemoClient(async ({ Runtime }) => {
        const expr = `(() => {
          const el = document.querySelector(${JSON.stringify(input.selector)})
          if (!el) throw new Error('not_found')
          const tag = el.tagName
          if (tag !== 'INPUT' && tag !== 'TEXTAREA') throw new Error('not_input')
          el.focus()
          el.value = ${JSON.stringify(input.value)}
          el.dispatchEvent(new Event('input', { bubbles: true }))
          el.dispatchEvent(new Event('change', { bubbles: true }))
          return true
        })()`
        await Runtime.evaluate({ expression: expr, returnByValue: true })
      })
      return ok()
    }
  )

  server.tool(
    'overlay.toggle',
    {
      description: 'Toggle the Anchor overlay button (__anchor_ghost_toggle__)',
      inputSchema: { type: 'object', properties: {} }
    },
    async () => {
      await withDemoClient(async ({ Runtime }) => {
        const haveToggle = await Runtime.evaluate({
          expression: "!!document.getElementById('__anchor_ghost_toggle__')",
          returnByValue: true
        })
        if (!haveToggle.result.value) {
          throw new Error('toggle_button_missing')
        }
        await Runtime.evaluate({
          expression: "document.getElementById('__anchor_ghost_toggle__').click(); true;",
          returnByValue: true
        })
      })
      return ok()
    }
  )

  server.tool(
    'demo.fill',
    {
      description: 'Fill the demo EHR form with deterministic sample values',
      inputSchema: { type: 'object', properties: {} }
    },
    async () => {
      await withDemoClient(async ({ Runtime }) => {
        const expr = `(() => {
          const values = {
            '#pt_name': 'Jane Doe',
            '#dob': '01/01/1990',
            '#cc': 'Fever and cough x3d; denies SOB.'
          }
          for (const [selector, value] of Object.entries(values)) {
            const el = document.querySelector(selector)
            if (!el) continue
            el.value = value
            el.dispatchEvent(new Event('input', { bubbles: true }))
            el.dispatchEvent(new Event('change', { bubbles: true }))
          }
          return true
        })()`
        await Runtime.evaluate({ expression: expr, returnByValue: true })
      })
      return ok()
    }
  )

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

program
  .command('ready')
  .description('Launch Chrome (DevTools) and open the demo EHR page')
  .action(async () => {
    await chromeEnsure()
    await openDemo()
    console.log('Ready.')
  })

program
  .command('status')
  .description('Show Chrome/extension status')
  .action(async () => {
    await status()
  })

program
  .command('smoke')
  .description('Run CDP-based smoke test against the demo page')
  .action(async () => {
    await smoke()
  })

program
  .command('kill')
  .description('Kill the DevTools Chrome session')
  .action(async () => {
    await killChrome()
  })

program
  .command('mcp')
  .option('--stdio', 'Expose MCP server over stdio')
  .description('Run MCP server for Codex/Claude clients')
  .action(async (opts) => {
    if (!opts.stdio) {
      console.log('Use: codex mcp --stdio')
      return
    }
    await mcpServer()
  })

program.parseAsync(process.argv)
