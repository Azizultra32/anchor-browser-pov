import { initOverlay, togglePanel, mapCurrentPage, sendCurrentMap, fillDemoPlan } from './overlay'

// Entry point
console.log('[AnchorGhost] Content script loaded on:', location.href)
initOverlay()

const chromeApi = (globalThis as typeof globalThis & { chrome?: any }).chrome

if (chromeApi?.runtime?.onMessage) {
  const handlers: Record<string, () => void> = {
    TOGGLE_OVERLAY: () => { togglePanel() },
    MAP: () => { mapCurrentPage() },
    SEND_MAP: () => { void sendCurrentMap() },
    FILL_DEMO: () => { void fillDemoPlan() }
  }

  chromeApi.runtime.onMessage.addListener((message: { type?: string }) => {
    if (!message?.type) return
    const handler = handlers[message.type]
    if (handler) {
      handler()
    }
  })
}

// ============================================================================
// MCP BRIDGE - Expose functions for MCP server to call via CDP
// ============================================================================
// Works around Chrome MV3 isolated worlds by using custom events

window.addEventListener('__ANCHOR_MCP_MAP_REQUEST__', () => {
  mapCurrentPage()
  // Give overlay time to collect fields, then respond
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('__ANCHOR_MCP_MAP_RESPONSE__', {
      detail: { success: true, triggered: 'mapCurrentPage' }
    }))
  }, 500)
})

window.addEventListener('__ANCHOR_MCP_SEND_REQUEST__', () => {
  void sendCurrentMap()
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('__ANCHOR_MCP_SEND_RESPONSE__', {
      detail: { success: true, triggered: 'sendCurrentMap' }
    }))
  }, 500)
})

window.addEventListener('__ANCHOR_MCP_FILL_REQUEST__', () => {
  void fillDemoPlan()
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('__ANCHOR_MCP_FILL_RESPONSE__', {
      detail: { success: true, triggered: 'fillDemoPlan' }
    }))
  }, 500)
})

console.log('[AnchorGhost] MCP bridge initialized')

// No-op export for esbuild
export { }
