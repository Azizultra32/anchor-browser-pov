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

// No-op export for esbuild
export { }
