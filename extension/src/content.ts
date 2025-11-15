import { initOverlay } from './overlay';

try {
  console.log('[AnchorGhost] Content script loaded:', location.href);
  initOverlay();
} catch (err) {
  console.error('[AnchorGhost] init failure:', err);
}

export {};