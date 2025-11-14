#!/usr/bin/env node
import { ensureExtensionState, DEFAULT_PORT, DEFAULT_EXTENSION_NAME } from './lib/extension-tools.mjs'

function parseArgs () {
  const args = { port: DEFAULT_PORT, extensionName: DEFAULT_EXTENSION_NAME, requireFileAccess: true }
  for (const part of process.argv.slice(2)) {
    if (part.startsWith('--port=')) args.port = Number(part.split('=')[1])
    if (part.startsWith('--extension=')) args.extensionName = part.split('=')[1]
    if (part === '--no-file-access') args.requireFileAccess = false
  }
  return args
}

async function main () {
  const { port, extensionName, requireFileAccess } = parseArgs()
  const result = await ensureExtensionState({ port, extensionName, requireFileAccess })
  console.log(JSON.stringify({
    port,
    extensionName,
    devModeEnabled: result.devModeEnabled,
    fileAccessEnabled: result.extension?.fileAccessEnabled ?? null
  }, null, 2))
}

main().catch(err => {
  console.error('ensure-extension-state failed:', err.message)
  process.exitCode = 1
})
