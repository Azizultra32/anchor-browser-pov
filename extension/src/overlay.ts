// Minimal, self-contained overlay bootstrap with a floating toggle button.
// - Always injects a "Ghost" button (id="__anchor_ghost_toggle__").
// - On click: dispatches 'anchor:toggle' and shows a fallback panel if none exists.
// - Fallback panel includes buttons with data-action="map|send-map|fill-demo" so smoke can run.

const TOGGLE_BUTTON_ID = '__anchor_ghost_toggle__';
const PANEL_ID = '__anchor_overlay_panel__';

function ensureFallbackPanel() {
  let panel = document.getElementById(PANEL_ID) as HTMLDivElement | null;
  if (!panel) {
    panel = document.createElement('div');
    panel.id = PANEL_ID;
    Object.assign(panel.style, {
      position: 'fixed',
      top: '56px',
      right: '16px',
      width: '280px',
      background: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      boxShadow: '0 12px 28px rgba(0,0,0,.18)',
      padding: '12px',
      zIndex: '2147483646',
      display: 'none',
      fontFamily: 'ui-sans-serif, -apple-system, Segoe UI, sans-serif'
    } as CSSStyleDeclaration);
    panel.innerHTML = `
      <div style="font-weight:700;margin-bottom:8px;">Anchor Overlay</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button data-action="map">Map</button>
        <button data-action="send-map">Send Map</button>
        <button data-action="fill-demo">Fill (Demo)</button>
      </div>
    `;
    document.body.appendChild(panel);
  }
  return panel;
}

function togglePanelVisibility(explicit?: boolean) {
  const panel = ensureFallbackPanel();
  const wantsOpen = explicit ?? (panel.style.display === 'none');
  panel.style.display = wantsOpen ? 'block' : 'none';
}

function ensureToggleButton() {
  if (document.getElementById(TOGGLE_BUTTON_ID)) return;

  const btn = document.createElement('button');
  btn.id = TOGGLE_BUTTON_ID;
  btn.type = 'button';
  btn.textContent = 'Ghost';

  Object.assign(btn.style, {
    position: 'fixed',
    top: '16px', right: '16px',
    zIndex: '2147483646',
    padding: '8px 14px',
    borderRadius: '999px',
    border: 'none',
    fontSize: '13px',
    fontWeight: '600',
    color: '#f8fafc',
    background: '#2563eb',
    boxShadow: '0 8px 18px rgba(37,99,235,.35)',
    cursor: 'pointer'
  } as CSSStyleDeclaration);

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    document.dispatchEvent(new CustomEvent('anchor:toggle'));
    togglePanelVisibility(); // fallback panel
  });

  const append = () => {
    if (!document.getElementById(TOGGLE_BUTTON_ID)) document.body.appendChild(btn);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', append, { once: true });
  } else {
    append();
  }
}

export function initOverlay() {
  ensureToggleButton();
  // If your real overlay system exists, it can also listen:
  // document.addEventListener('anchor:toggle', () => realTogglePanel());
}