#!/usr/bin/env node
import CDP from 'chrome-remote-interface'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { getExtensionState, DEFAULT_EXTENSION_NAME, DEFAULT_PORT } from './lib/extension-tools.mjs'

function parseArgs () {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const repoRoot = path.resolve(scriptDir, '..')
  const defaultDemoPath = path.join(repoRoot, 'demo', 'ehr.html')
  const args = {
    port: DEFAULT_PORT,
    extensionName: DEFAULT_EXTENSION_NAME,
    demoUrl: pathToFileURL(defaultDemoPath).toString()
  }
  for (const part of process.argv.slice(2)) {
    if (part.startsWith('--port=')) args.port = Number(part.split('=')[1])
    if (part.startsWith('--extension=')) args.extensionName = part.split('=')[1]
    if (part.startsWith('--demo=')) args.demoUrl = part.split('=')[1]
    if (part === '--no-demo') args.demoUrl = null
  }
  return args
}

async function ensureDevToolsPort (port) {
  const url = `http://localhost:${port}/json/version`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`DevTools endpoint ${url} not reachable (${res.status})`)
  return res.json()
}

async function checkDemoPage ({ port, url }) {
  const target = await CDP.New({ port, url: 'about:blank' })
  const client = await CDP({ port, target })
  const { Page, Runtime, Log } = client
  const logs = []
  await Page.enable()
  await Runtime.enable()
  await Log.enable()
  Runtime.consoleAPICalled(({ args }) => {
    const text = args.map(a => a.value ?? a.description ?? '').join(' ')
    logs.push(text)
  })
  const loadPromise = new Promise(resolve => {
    Page.loadEventFired(() => resolve())
  })
  await Page.navigate({ url })
  await loadPromise
  await new Promise(resolve => setTimeout(resolve, 500))
  const { result } = await Runtime.evaluate({ expression: 'typeof findCandidates', returnByValue: true })
  const hasGhostLog = logs.some(text => /AssistMD|Ghost/i.test(text))
  await client.close()
  try {
    await CDP.Close({ port, id: target.id })
  } catch (_) {}
  return {
    findCandidatesType: result.value,
    hasGhostLog
  }
}

async function main () {
  const { port, extensionName, demoUrl } = parseArgs()
  const summary = {
    port,
    extensionName,
    chromeVersion: null,
    devModeEnabled: false,
    extensionFound: false,
    fileAccessEnabled: null,
    extensionErrors: [],
    demoCheck: null
  }
  const issues = []
  try {
    const version = await ensureDevToolsPort(port)
    summary.chromeVersion = version.Browser
  } catch (err) {
    issues.push(err.message)
  }
  try {
    const state = await getExtensionState({ port })
    summary.devModeEnabled = state.devModeEnabled === true
    summary.extensionErrors = state.errors || []
    const extension = state.items.find(i => i.name === extensionName)
    if (!extension) {
      issues.push(`Extension "${extensionName}" not listed on chrome://extensions`)
    } else {
      summary.extensionFound = true
      summary.fileAccessEnabled = extension.fileAccessEnabled
      if (extension.fileAccessEnabled === false) {
        issues.push('Allow access to file URLs is disabled')
      }
      if (extension.hasError) {
        issues.push('Extension reports error badge')
      }
    }
    if (state.devModeEnabled === false) {
      issues.push('Developer mode toggle is OFF')
    }
    if (state.errors?.length) {
      issues.push(...state.errors)
    }
  } catch (err) {
    issues.push(err.message)
  }

  if (demoUrl) {
    try {
      summary.demoCheck = await checkDemoPage({ port, url: demoUrl })
      if (summary.demoCheck.findCandidatesType !== 'function') {
        issues.push('Content script not injected on demo page')
      }
    } catch (err) {
      issues.push(`Demo check failed: ${err.message}`)
    }
  }

  console.log(JSON.stringify({ summary, issues }, null, 2))
  if (issues.length) {
    process.exitCode = 1
  }
}

main()
