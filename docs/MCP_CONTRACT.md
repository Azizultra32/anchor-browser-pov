# Anchor Browser – MCP Contract

This document defines the JSON contracts and tool semantics for using the Anchor Ghost Spine with an MCP-capable client (Codex CLI, chrome-devtools-mcp, etc.).

The core idea:

- The **browser extension** maps the DOM into a PHI-safe `DomMap`.
- The **agent** builds a deterministic `FillPlan` from that map.
- The **browser extension** (or a CDP-based runner) executes the plan against the page.

LLMs and MCP clients never see raw PHI; they see only field metadata and plans.

---

## Data Schemas

All types are expressed in TypeScript-style notation for clarity.

### `FieldDescriptor`

A single mapped field on the page.

```ts
interface FieldDescriptor {
  /** CSS selector that uniquely identifies this field on the page. */
  selector: string;

  /** Human-readable label (from <label>, aria-label, placeholder, etc.). */
  label: string;

  /** Semantic role: e.g. "textbox", "textarea", "combobox", "checkbox". */
  role: string;

  /** True if the field is editable (not readonly/disabled). */
  editable: boolean;

  /** True if the field is visible and on-screen when mapped. */
  visible: boolean;
}
```

### `DomMap`

A PHI-safe snapshot of the page form structure.

```ts
interface DomMap {
  /** URL of the page when mapping occurred. */
  url: string;

  /** ISO timestamp for when the map was captured. */
  capturedAt: string;

  /** Mapped fields on the current page. */
  fields: FieldDescriptor[];
}
```

### `FillStep`

A single mutation to apply to the DOM.

```ts
type FillActionType = "setValue";

interface FillStep {
  /** CSS selector of the target element. */
  selector: string;

  /** The action to apply. For now only "setValue" is supported. */
  action: FillActionType;

  /** The value to write into the field. */
  value: string;

  /** Optional label for debugging / logging. */
  label?: string;
}
```

### `FillPlan`

A deterministic plan describing how to populate the page.

```ts
interface FillPlan {
  /** Opaque ID for this plan (unique per plan). */
  id: string;

  /** URL the plan is intended for. */
  url: string;

  /** ISO timestamp when the plan was created. */
  createdAt: string;

  /** Steps to apply to the DOM. */
  steps: FillStep[];

  /**
   * If a specific note field was identified, its selector is repeated here
   * for clarity and auditability.
   */
  noteTargetSelector?: string;

  /**
   * Optional metadata, e.g. mode: "demo"|"prod", heuristic info, etc.
   * This is free-form and for debugging / observability.
   */
  meta?: Record<string, unknown>;
}
```

### `ExecutionResult`

A result object for executing a plan.

> **Note:** In the current architecture, execution still happens inside the browser (content script), and the Node agent acts as a planner. `ExecutionResult` is reserved for future CDP-based execution flows.

```ts
interface ExecutionError {
  selector: string;
  message: string;
}

interface ExecutionResult {
  /** ID of the plan that was executed. */
  planId: string;

  /** True if execution completed without fatal error. */
  ok: boolean;

  /** Count of successful steps. */
  applied: number;

  /** Count of failed steps. */
  failed: number;

  /** Optional list of per-step errors. */
  errors?: ExecutionError[];

  /**
   * Optional opaque token that can later be used to undo the operation,
   * if the executor implementation supports it.
   */
  undoToken?: string;
}
```

---

## Agent HTTP API

All endpoints are JSON over HTTP.

**Base URL (current POC):** `http://localhost:8787/`

### `GET /`

Health check.

```json
{ "ok": true, "service": "anchor-agent", "version": "0.1.0" }
```

### `POST /dom`

Stores the latest DOM map.

Request:

```json
{
  "url": "http://localhost:8788/ehr.html",
  "fields": [
    {
      "selector": "#pt_name",
      "label": "Patient Name",
      "role": "textbox",
      "editable": true,
      "visible": true
    }
  ]
}
```

Behavior:

- Agent attaches `capturedAt` automatically.
- Stores this as the current `DomMap`.

Response:

```json
{
  "ok": true,
  "fields": 12,
  "capturedAt": "2025-11-14T20:19:20.123Z"
}
```

### `POST /actions/plan`

Builds a deterministic `FillPlan` from a DOM map and an optional note.

Request (demo POC mode):

```json
{
  "url": "http://localhost:8788/ehr.html",
  "fields": [
    {
      "selector": "#pt_name",
      "label": "Patient Name",
      "role": "textbox",
      "editable": true,
      "visible": true
    }
  ],
  "note": "Patient presents with cough and fever for 3 days.",
  "mode": "demo"
}
```

- If `fields` is omitted, the agent uses the latest map sent to `/dom` for that URL.
- Current behavior (POC):
  - Filters to editable fields only.
  - Finds a single “note target” field by label/role heuristic (labels containing note, assessment, plan, subjective, HPI, etc., or textarea-like roles).
  - Builds `FillStep`s where:
    - The note target receives the raw note text.
    - All other editable fields receive deterministic demo values: `DEMO_` + `SLUG(label)`.

Response:

```json
{
  "id": "plan_1731605960123_1",
  "url": "http://localhost:8788/ehr.html",
  "createdAt": "2025-11-14T20:19:20.123Z",
  "noteTargetSelector": "#note",
  "steps": [
    {
      "selector": "#pt_name",
      "action": "setValue",
      "value": "DEMO_PATIENT_NAME",
      "label": "Patient Name"
    },
    {
      "selector": "#note",
      "action": "setValue",
      "value": "Patient presents with cough and fever for 3 days.",
      "label": "Note"
    }
  ],
  "meta": {
    "mode": "demo",
    "strategy": "single-note-target"
  }
}
```

> This is intentionally simple and deterministic at this stage. Future implementations can use an LLM to construct steps, but the shape of `FillPlan` remains the same.

### `POST /actions/execute` (reserved / future)

Reserved for a future executor that runs plans via CDP inside the agent process.

Request:

```json
{ "planId": "plan_1731605960123_1" }
```

or

```json
{ "plan": { /* FillPlan */ } }
```

Response (current stub):

```json
{
  "planId": "plan_1731605960123_1",
  "ok": false,
  "applied": 0,
  "failed": 0,
  "errors": [
    {
      "selector": "#pt_name",
      "message": "Executor not implemented in this build"
    }
  ]
}
```

Execution remains inside the browser via the content script in the present POC.

### `POST /actions/fill` (legacy POC endpoint)

- Thin wrapper around `/actions/plan`.
- Accepts the same body, returns the same `FillPlan` shape.
- Current content script still calls this endpoint.
- Over time, the extension can migrate to `/actions/plan` directly.

---

## MCP Tool Examples

A future MCP server can expose tools such as:

- `anchor_map_page(url: string) → DomMap`
- `anchor_plan_fill(url: string, fields?: FieldDescriptor[], note?: string) → FillPlan`

These tools:

1. Use Chrome DevTools to navigate and trigger the extension’s MAP flow.
2. Call the HTTP agent endpoints described above.
3. Return the resulting JSON objects to the LLM.

This contract gives the LLM a stable, PHI-safe interface to the EHR structure and the actions it can safely request.
