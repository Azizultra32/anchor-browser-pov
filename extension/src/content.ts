import { initOverlay } from './overlay';

try {
  console.log('[AnchorGhost] Content script loaded:', location.href);
  initOverlay();
  setupBridgeListener();
} catch (err) {
  console.error('[AnchorGhost] init failure:', err);
}

// MCP Bridge Event Listener
function setupBridgeListener() {
  window.addEventListener('ANCHOR_BRIDGE_EVENT', async (event: any) => {
    const { action, payload } = event.detail;
    console.log('[AnchorGhost] Bridge event received:', action, payload);

    let responseData: any;

    try {
      switch (action) {
        case 'MAP':
          responseData = await handleMapAction(payload);
          break;

        case 'FILL':
          responseData = await handleFillAction(payload);
          break;

        default:
          responseData = { error: `Unknown action: ${action}` };
      }
    } catch (error) {
      console.error('[AnchorGhost] Bridge action error:', error);
      responseData = {
        error: error instanceof Error ? error.message : String(error)
      };
    }

    // Dispatch response event
    const responseEvent = new CustomEvent('ANCHOR_BRIDGE_RESPONSE', {
      detail: {
        action: `${action}_RESPONSE`,
        data: responseData,
      },
    });
    window.dispatchEvent(responseEvent);
  });

  console.log('[AnchorGhost] Bridge listener ready');
}

async function handleMapAction(payload: any) {
  const ghost = (window as any).__ANCHOR_GHOST__;
  if (!ghost) {
    throw new Error('Ghost overlay not initialized');
  }

  return await ghost.map(payload);
}

async function handleFillAction(payload: any) {
  const ghost = (window as any).__ANCHOR_GHOST__;
  if (!ghost) {
    throw new Error('Ghost overlay not initialized');
  }

  return await ghost.fill(payload);
}

export {};