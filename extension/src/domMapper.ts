export type FieldMeta = {
  label: string
  role: string
  selector: string
  editable: boolean
  visible: boolean
}

function isVisible(el: Element): boolean {
  const rect = (el as HTMLElement).getBoundingClientRect?.()
  const style = window.getComputedStyle(el)
  if (!rect) return false
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.visibility !== 'hidden' &&
    style.display !== 'none'
  )
}

function labelFor(el: HTMLElement): string {
  // ARIA label precedence
  const aria = el.getAttribute('aria-label')
  if (aria) return aria.trim()

  // label[for] lookup
  const id = el.id
  if (id) {
    const lab = document.querySelector(`label[for="${CSS.escape(id)}"]`)
    if (lab) return (lab.textContent || '').trim()
  }

  // Closest label ancestor
  const closestLabel = el.closest('label')
  if (closestLabel) return (closestLabel.textContent || '').trim()

  // Placeholder hint as last resort (never value!)
  const ph = (el as HTMLInputElement).placeholder
  if (ph) return ph.trim()

  return el.getAttribute('name') || el.getAttribute('id') || el.tagName.toLowerCase()
}

export function mapDom(): FieldMeta[] {
  const candidates = Array.from(document.querySelectorAll('input, textarea, select'))
  return candidates.map((el) => {
    const htmlEl = el as HTMLElement
    const role = htmlEl.getAttribute('role') || el.tagName.toLowerCase()
    const editable = !(htmlEl as HTMLInputElement).readOnly && !(htmlEl as HTMLInputElement).disabled
    const selector = uniqueSelector(htmlEl)
    const visible = isVisible(htmlEl)
    return {
      label: labelFor(htmlEl),
      role,
      selector,
      editable,
      visible
    }
  }).filter(f => f.visible)
}

// very simple unique selector (improve later with multiple fallbacks)
function uniqueSelector(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`
  const parts: string[] = []
  let cur: Element | null = el
  while (cur && parts.length < 5) {
    let part = cur.tagName.toLowerCase()
    const idx = Array.from(cur.parentElement?.children || []).indexOf(cur)
    part += `:nth-child(${idx+1})`
    parts.unshift(part)
    cur = cur.parentElement
  }
  return parts.join(' > ')
}
