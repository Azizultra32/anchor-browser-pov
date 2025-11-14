import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'

const app = express()
app.use(cors())
app.use(bodyParser.json({ limit: '2mb' }))

let latestMap: any = null

app.get('/', (_req, res) => {
  res.json({ ok: true, msg: 'Anchor Ghost Agent running' })
})

app.post('/dom', (req, res) => {
  latestMap = { ts: Date.now(), ...req.body }
  res.json({ ok: true, fields: Array.isArray(req.body?.fields) ? req.body.fields.length : 0 })
})

app.post('/actions/fill', (req, res) => {
  const fields = Array.isArray(req.body?.fields) ? req.body.fields : []
  const note: string = typeof req.body?.note === 'string' ? req.body.note : ''

  const editable = fields.filter((f: any) => f?.editable && typeof f?.selector === 'string')
  const actions: Array<{ type: string; selector: string; value: string }> = []
  const used = new Set<string>()

  const pickNoteTarget = () => {
    const candidates = editable.filter((f: any) => {
      const label = String(f?.label ?? '')
      return /note|assessment|plan|subjective|hpi/i.test(label) || /textarea/i.test(String(f?.role ?? ''))
    })
    return candidates[0] || editable[0]
  }

  if (note.trim()) {
    const noteTarget = pickNoteTarget()
    if (noteTarget) {
      actions.push({
        type: 'setValue',
        selector: noteTarget.selector,
        value: note.trim()
      })
      used.add(noteTarget.selector)
    }
  }

  for (const f of editable) {
    if (used.has(f.selector)) continue
    actions.push({
      type: 'setValue',
      selector: f.selector,
      value: `DEMO_${slug(f.label)}`
    })
    used.add(f.selector)
  }

  res.json({ ok: true, actions })
})

function slug(s: string) {
  return String(s || 'field')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

const port = process.env.PORT || 8787
app.listen(port, () => {
  console.log('Anchor Ghost Agent on http://localhost:' + port)
})
