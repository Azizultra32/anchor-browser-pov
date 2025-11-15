import CDP from 'chrome-remote-interface'

const delay = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms))

export const DEFAULT_PORT = Number(process.env.MCP_DEBUG_PORT || process.env.PORT || 9222)
export const DEFAULT_EXTENSION_NAME = process.env.MCP_EXTENSION_NAME || 'Anchor Ghost Overlay (POC)'

async function withExtensionsPage (port, handler) {
  const target = await CDP.New({ port, url: 'chrome://extensions/' })
  const client = await CDP({ port, target })
  const { Page, Runtime } = client

  await Page.enable()
  await Runtime.enable()
  const loadPromise = new Promise(resolve => {
    Page.loadEventFired(() => resolve())
  })
  await Page.navigate({ url: 'chrome://extensions/' })
  await loadPromise

  // wait for extensions-manager shadow DOM to be ready
  const readyScript = '(() => !!document.querySelector("extensions-manager")?.shadowRoot)()'
  for (let i = 0; i < 20; i++) {
    const { result } = await Runtime.evaluate({ expression: readyScript, returnByValue: true })
    if (result?.value) break
    await delay(250)
    if (i === 19) {
      throw new Error('extensions-manager shadow root missing')
    }
  }

  try {
    return await handler({ client, Page, Runtime })
  } finally {
    await client.close()
    try {
      await CDP.Close({ port, id: target.id })
    } catch (_) {
      /* no-op */
    }
  }
}

function extractState () {
  const data = { devModeEnabled: null, items: [], errors: [] }
  const manager = document.querySelector('extensions-manager')
  if (!manager) {
    data.errors.push('extensions-manager missing')
    return data
  }
  const mgrShadow = manager.shadowRoot
  if (!mgrShadow) {
    data.errors.push('shadow root missing on extensions-manager')
    return data
  }
  const toolbar = mgrShadow.querySelector('extensions-toolbar')
  const toolbarShadow = toolbar?.shadowRoot
  const devToggle = toolbarShadow?.querySelector('#devMode')
  if (devToggle) {
    data.devModeEnabled = devToggle.hasAttribute('checked') || devToggle.getAttribute('aria-pressed') === 'true' || devToggle.checked === true
  } else {
    data.errors.push('dev mode toggle missing')
  }

  const list = mgrShadow.querySelector('extensions-item-list')
  const listShadow = list?.shadowRoot
  if (!listShadow) {
    data.errors.push('extensions-item-list shadow root missing')
    return data
  }
  const items = Array.from(listShadow.querySelectorAll('extensions-item'))
  data.items = items.map(item => {
    const shadow = item.shadowRoot
    const allowFileAccess = shadow?.querySelector('#allowFileAccess')
    const fileAccessEnabled = allowFileAccess
      ? (allowFileAccess.hasAttribute('checked') || allowFileAccess.getAttribute('aria-pressed') === 'true' || allowFileAccess.checked === true)
      : null
    const errorBadge = shadow?.querySelector('#error-icon, #errorIcon, #errorBadge, #error-message-chip, #cr-icon[icon="cr:error"]')
    const hasError = !!(errorBadge && !errorBadge.hasAttribute('hidden') && getComputedStyle(errorBadge).display !== 'none')
    return {
      name: shadow?.querySelector('#name')?.textContent?.trim() || '',
      id: shadow?.querySelector('#entity-id')?.textContent?.trim() || item.getAttribute('id') || '',
      hasError,
      hasAllowFileAccess: !!allowFileAccess,
      fileAccessEnabled
    }
  })
  return data
}

export async function getExtensionState ({ port = DEFAULT_PORT } = {}) {
  return withExtensionsPage(port, async ({ Runtime }) => {
    const { result } = await Runtime.evaluate({
      expression: `(${extractState.toString()})()`,
      returnByValue: true
    })
    return result.value
  })
}

async function clickDevModeToggle ({ port = DEFAULT_PORT }) {
  return withExtensionsPage(port, async ({ Runtime }) => {
    const { result } = await Runtime.evaluate({
      expression: `(() => {
        const manager = document.querySelector('extensions-manager');
        const toggle = manager?.shadowRoot?.querySelector('extensions-toolbar')?.shadowRoot?.querySelector('#devMode');
        toggle?.click();
        return !!toggle;
      })()`,
      returnByValue: true
    })
    if (!result.value) throw new Error('Developer mode toggle not found')
  })
}

async function setFileAccessToggle ({ port = DEFAULT_PORT, extensionName = DEFAULT_EXTENSION_NAME, enabled }) {
  return withExtensionsPage(port, async ({ Runtime }) => {
    const { result } = await Runtime.evaluate({
      expression: `((targetName, desired) => {
        const manager = document.querySelector('extensions-manager');
        const list = manager?.shadowRoot?.querySelector('extensions-item-list');
        const items = list?.shadowRoot ? Array.from(list.shadowRoot.querySelectorAll('extensions-item')) : [];
        const match = items.find(item => item.shadowRoot?.querySelector('#name')?.textContent?.trim() === targetName);
        if (!match) return { found: false };
        const toggle = match.shadowRoot?.querySelector('#allowFileAccess');
        if (!toggle) return { found: true, hasToggle: false };
        const current = toggle.hasAttribute('checked') || toggle.getAttribute('aria-pressed') === 'true' || toggle.checked === true;
        if (current !== desired) toggle.click();
        return { found: true, hasToggle: true };
      })(${JSON.stringify(extensionName)}, ${enabled})`,
      returnByValue: true
    })
    const value = result.value || {}
    if (!value.found) throw new Error(`Extension "${extensionName}" not found on chrome://extensions`)
    if (!value.hasToggle) throw new Error(`Extension "${extensionName}" missing Allow access to file URLs toggle`)
  })
}

export async function ensureExtensionState ({
  port = DEFAULT_PORT,
  extensionName = DEFAULT_EXTENSION_NAME,
  requireFileAccess = true
} = {}) {
  const state = await getExtensionState({ port })
  if (state.errors?.length) {
    throw new Error(`chrome://extensions reported: ${state.errors.join(', ')}`)
  }
  if (state.devModeEnabled === false) {
    await clickDevModeToggle({ port })
    await delay(500)
  }
  const refreshed = await getExtensionState({ port })
  const extension = refreshed.items.find(i => i.name === extensionName)
  if (!extension) throw new Error(`Extension "${extensionName}" not found after refresh`)
  if (requireFileAccess && extension.hasAllowFileAccess && extension.fileAccessEnabled === false) {
    await setFileAccessToggle({ port, extensionName, enabled: true })
    await delay(500)
  }
  return {
    devModeEnabled: refreshed.devModeEnabled !== false,
    extension
  }
}
