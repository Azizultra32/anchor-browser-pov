import { mapDom, type FieldMeta } from './domMapper'
import { uiModeManager, type UIMode } from './uiModes'

let shadowRoot: ShadowRoot | null = null

const styles = `
:host {
  all: initial;
}
textarea, button {
  font-family: inherit;
}
.panel {
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, Noto Sans, sans-serif;
  position: fixed;
  top: 16px;
  right: 16px;
  width: 320px;
  max-height: 70vh;
  overflow: auto;
  border-radius: 12px;
  box-shadow: 0 8px 28px rgba(0,0,0,0.2);
  background: #0f172a;
  color: #e5e7eb;
  border: 1px solid rgba(255,255,255,0.12);
  z-index: 2147483647;
}
.panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  font-weight: 600;
  background: #111827;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.panel button {
  cursor: pointer;
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 8px;
  background: #1f2937;
  color: #e5e7eb;
  padding: 6px 10px;
  margin: 6px 6px 6px 0;
}
.panel .body {
  padding: 10px 12px 12px 12px;
  font-size: 12.5px;
}
.note-section {
  margin: 8px 0 12px;
  display: grid;
  gap: 6px;
}
.note-section textarea {
  width: 100%;
  min-height: 96px;
  resize: vertical;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.18);
  background: #0b1220;
  color: #e5e7eb;
  padding: 8px;
}
.note-section label {
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  opacity: 0.8;
}
.field {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px dashed rgba(255,255,255,0.08);
}
kbd {
  background: #0b1220;
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 4px;
  padding: 0 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 11px;
}
`

type EditableEl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLElement

const NOTE_INPUT_ID = 'anchorGhostNoteInput'
const TOGGLE_BUTTON_ID = '__anchor_ghost_toggle__'
const PANEL_HOST_ID = '__anchor_ghost_overlay__'
const snapshotFields = () => mapDom()

let noteText = `Demo clinical note.
Vitals stable.
Plan: follow-up in 2 weeks.`

let undoBuffer: Array<{ el: EditableEl; selector: string; previous: string }> = []

function ensureToggleButton() {
  if (document.getElementById(TOGGLE_BUTTON_ID)) return
  const btn = document.createElement('button')
  btn.id = TOGGLE_BUTTON_ID
  btn.dataset.anchorGhostButton = 'true'
  btn.type = 'button'
  btn.textContent = 'Ghost'
  Object.assign(btn.style, {
    position: 'fixed',
    top: '16px',
    right: '16px',
    zIndex: '2147483646',
    padding: '8px 14px',
    borderRadius: '999px',
    border: 'none',
    fontSize: '13px',
    fontWeight: '600',
    fontFamily: 'ui-sans-serif, -apple-system, Segoe UI, sans-serif',
    color: '#f8fafc',
    background: '#2563eb',
    boxShadow: '0 8px 18px rgba(37, 99, 235, 0.35)',
    cursor: 'pointer'
  })
  btn.addEventListener('click', (evt) => {
    evt.preventDefault()
    evt.stopPropagation()
    togglePanel()
  })
  const append = () => {
    if (document.getElementById(TOGGLE_BUTTON_ID)) return
    document.body?.appendChild(btn)
  }
  if (document.body) {
    append()
  } else {
    document.addEventListener('DOMContentLoaded', append, { once: true })
  }
}

function ensurePanel(): HTMLElement {
  let host = document.getElementById(PANEL_HOST_ID)
  if (!host) {
    host = document.createElement('div')
    host.id = PANEL_HOST_ID
    host.style.all = 'initial'
    host.attachShadow({ mode: 'open' })
    document.documentElement.appendChild(host)
  }
  shadowRoot = (host as any).shadowRoot

  // Inject styles into shadow DOM once
  if (!shadowRoot!.querySelector('style[data-anchor-ghost]')) {
    const styleSheet = document.createElement('style')
    styleSheet.dataset.anchorGhost = 'true'
    styleSheet.textContent = styles.trim()
    shadowRoot!.appendChild(styleSheet)
  }

  const panel = document.createElement('div')
  panel.className = 'panel'
  panel.innerHTML = `
    <header>
      <span>Anchor Ghost Overlay</span>
      <div>
        <button id="btnMode" style="margin-right:4px">Mode</button>
        <button id="btnClose">Close</button>
      </div>
    </header>
    <div class="body">
      <div style="margin-bottom:8px">
        <button id="btnMap">Map</button>
        <button id="btnSend">Send Map</button>
        <button id="btnFill">Fill (Demo)</button>
        <span style="opacity:.7;margin-left:8px">Toggle: <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>G</kbd></span>
      </div>
      <div class="note-section">
        <label for="${NOTE_INPUT_ID}">Note Preview</label>
        <textarea id="${NOTE_INPUT_ID}" placeholder="Paste or type the note to preview/paste..."></textarea>
        <div style="opacity:.6;font-size:11px">Alt+Z restores the values from the last fill.</div>
      </div>
      <div id="fields"></div>
      <div id="log" style="margin-top:10px; opacity:.8"></div>
    </div>
  `
  shadowRoot!.appendChild(panel)

  const noteInput = shadowRoot!.getElementById(NOTE_INPUT_ID) as HTMLTextAreaElement | null
  if (noteInput) {
    noteInput.value = noteText
    noteInput.addEventListener('input', () => {
      noteText = noteInput.value
    })
  }

  shadowRoot!.getElementById('btnClose')!.addEventListener('click', removePanel)

  shadowRoot!.getElementById('btnMode')!.addEventListener('click', () => {
    const newMode = uiModeManager.toggleMode()
    updateUIForMode()
    log(`Switched to ${newMode} mode`)
  })

  shadowRoot!.getElementById('btnMap')!.addEventListener('click', () => {
    mapCurrentPage()
  })

  shadowRoot!.getElementById('btnSend')!.addEventListener('click', () => {
    void sendCurrentMap()
  })

  shadowRoot!.getElementById('btnFill')!.addEventListener('click', () => {
    void fillDemoPlan()
  })

  // Apply initial UI mode
  updateUIForMode()

  // Listen for mode changes
  window.addEventListener('__GHOST_UI_MODE_CHANGE__', updateUIForMode)

  return panel
}

function renderFields(fields: FieldMeta[]) {
  const root = shadowRoot!
  const container = root.getElementById('fields')!
  container.innerHTML = ''
  const config = uiModeManager.getConfig()
  
  fields.forEach(f => {
    const row = document.createElement('div')
    row.className = 'field'
    
    let content = `<div><strong>${escapeHtml(f.label)}</strong></div>`
    
    if (config.showMetadata) {
      content += `<div style="opacity:.7">${f.role}</div>`
    }
    
    if (config.showSelectors) {
      content += `<div style="opacity:.6;font-family:ui-monospace">${escapeHtml(f.selector)}</div>`
    }
    
    row.innerHTML = `
      <div>${content}</div>
      <div style="opacity:.8">${f.editable ? 'editable' : 'read‑only'}</div>
    `
    container.appendChild(row)
  })
  ;(container as any).__fields = fields
}

function currentFields(): FieldMeta[] {
  const root = shadowRoot!
  const container = root.getElementById('fields')!
  return (container as any).__fields || []
}

function readValue(el: EditableEl): string {
  if ('value' in el) return (el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value ?? ''
  if ((el as HTMLElement).isContentEditable) return (el as HTMLElement).innerText ?? ''
  return ''
}

function writeValue(el: EditableEl, value: string) {
  if ('value' in el) {
    ;(el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value = value
  } else if ((el as HTMLElement).isContentEditable) {
    ;(el as HTMLElement).innerText = value
  }
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

type PlanStep = {
  selector?: string
  type?: string
  action?: string
  value?: unknown
}

function getPlanSteps(plan: any): PlanStep[] {
  if (Array.isArray(plan?.actions)) return plan.actions
  if (Array.isArray(plan?.steps)) return plan.steps
  return []
}

function stepType(step: PlanStep) {
  return step.type || step.action || ''
}

function executeFillPlan(plan: any) {
  const steps = getPlanSteps(plan)
  if (!steps.length) return
  undoBuffer = []
  const seen = new Set<string>()
  for (const a of steps) {
    try {
      if (typeof a.selector !== 'string') continue
      const el = document.querySelector(a.selector) as EditableEl | null
      if (!el) continue
      if (!seen.has(a.selector)) {
        undoBuffer.push({ el, selector: a.selector, previous: readValue(el) })
        seen.add(a.selector)
      }
      if (stepType(a) === 'setValue') {
        writeValue(el, String(a.value ?? ''))
      }
    } catch { }
  }
  if (undoBuffer.length) {
    log(`Stored undo snapshot for ${undoBuffer.length} field(s). Alt+Z to restore.`)
  } else {
    log('No editable fields updated by plan.')
  }
}

function log(msg: string) {
  const root = shadowRoot!
  const el = root.getElementById('log')!
  const div = document.createElement('div')
  div.textContent = msg
  el.appendChild(div)
}

function updateUIForMode() {
  if (!shadowRoot) return
  
  const config = uiModeManager.getConfig()
  const modeBtn = shadowRoot.getElementById('btnMode')
  if (modeBtn) {
    modeBtn.textContent = config.mode === 'clinician' ? 'Clinician' : 'Debug'
  }
  
  // Re-render fields with new mode settings
  const fields = currentFields()
  if (fields.length > 0) {
    renderFields(fields)
  }
  
  // Update button visibility for simplified controls
  const technicalButtons = ['btnSend', 'btnFill']
  technicalButtons.forEach(id => {
    const btn = shadowRoot.getElementById(id)
    if (btn) {
      btn.style.display = config.simplifiedControls ? 'none' : 'inline-block'
    }
  })
}

function escapeHtml(s: string) {
  return s.replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c] as string))
}

function getPanelHost() {
  return document.getElementById(PANEL_HOST_ID)
}

function isPanelMounted() {
  return Boolean(getPanelHost())
}

function ensurePanelVisible() {
  if (!isPanelMounted() || !shadowRoot) {
    ensurePanel()
  }
}

function removePanel() {
  const host = getPanelHost()
  if (host) {
    host.remove()
  }
  shadowRoot = null
}

function initMcpBridge() {
  window.addEventListener('__ANCHOR_MCP_MAP_REQUEST__', () => {
    try {
      const detail = { url: location.href, fields: snapshotFields() }
      window.dispatchEvent(new CustomEvent('__ANCHOR_MCP_MAP_RESPONSE__', { detail }))
    } catch (error) {
      window.dispatchEvent(new CustomEvent('__ANCHOR_MCP_MAP_RESPONSE__', { detail: { error: (error as Error)?.message || String(error) } }))
    }
  })

  window.addEventListener('__ANCHOR_MCP_FILL_REQUEST__', (event) => {
    const { selector, value } = (event as CustomEvent<{ selector?: string; value?: string }>).detail || {}
    let success = false
    let error: string | null = null
    try {
      if (selector) {
        const el = document.querySelector(selector) as EditableEl | null
        if (el && isEditable(el)) {
          success = tryPaste(el, value ?? '')
          if (!success) {
            writeValue(el, value ?? '')
            success = true
          }
        } else {
          error = 'Field not found or not editable'
        }
      } else {
        error = 'Selector missing'
      }
    } catch (err) {
      error = (err as Error)?.message || String(err)
    }
    window.dispatchEvent(new CustomEvent('__ANCHOR_MCP_FILL_RESPONSE__', { detail: { success, selector, error } }))
  })

  console.log('AssistMD: MCP bridge initialized')
}

export function togglePanel() {
  if (isPanelMounted()) {
    removePanel()
  } else {
    ensurePanel()
  }
}

export function mapCurrentPage() {
  ensurePanelVisible()
  const fields = mapDom()
  renderFields(fields)
  log(`Mapped ${fields.length} fields`)
}

export async function sendCurrentMap() {
  ensurePanelVisible()
  const fields = currentFields()
  const res = await fetch('http://localhost:8787/dom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: location.href, fields })
  }).then(r => r.json()).catch(e => ({ error: String(e) }))
  log('Agent /dom response: ' + JSON.stringify(res))
}

export async function fillDemoPlan() {
  ensurePanelVisible()
  const fields = currentFields()
  const trimmedNote = noteText.trim()
  const plan = await fetch('http://localhost:8787/actions/fill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: location.href, fields, note: trimmedNote })
  }).then(r => r.json()).catch(e => ({ error: String(e) }))
  log('Agent plan: ' + JSON.stringify(plan))
  executeFillPlan(plan)
}

function undoLastFill() {
  if (!undoBuffer.length) {
    console.info('[AnchorGhost] Undo requested but buffer empty.')
    return
  }
  for (const item of undoBuffer) {
    try {
      writeValue(item.el, item.previous)
    } catch (err) {
      console.warn('[AnchorGhost] Failed restoring', item.selector, err)
    }
  }
  log('Undo restored previous field values.')
  undoBuffer = []
}

function isCtrlOrMeta(e: KeyboardEvent) {
  return e.ctrlKey || (navigator.platform.toLowerCase().includes('mac') && e.metaKey)
}

export function initOverlay() {
  ensureToggleButton()
  window.addEventListener('keydown', (e) => {
    if (isCtrlOrMeta(e) && e.altKey && e.key.toLowerCase() === 'g') {
      e.preventDefault()
      togglePanel()
      return
    }
    if (e.altKey && !e.shiftKey && e.code === 'KeyZ') {
      if (undoBuffer.length) {
        e.preventDefault()
        undoLastFill()
      }
    }
  })

  if (!(window as any).__ANCHOR_GHOST__) {
    ;(window as any).__ANCHOR_GHOST__ = {
      toggle: togglePanel,
      map: mapCurrentPage,
      send: sendCurrentMap,
      fill: fillDemoPlan,
      getFields: snapshotFields
    }
  }

  initMcpBridge()
}
