# Dashboard Panel — Feature Specification (Draft)

> **Status:** Early spec, not yet scheduled for implementation. This document is feature-centric: it describes *what the dashboard is and how it behaves* before any data shapes or endpoints are finalized. Code-level shapes below are **illustrative sketches** to anchor discussion, not final. It builds on the canonical design in [`application-design.md`](./application-design.md); principle references like **P2** point there.

---

## 1. Motivation (read this first)

There are two goals, and they are not equal:

1. **The grail — an MCP server that Claude drives.** The ultimate purpose of this feature is to let Claude (via an MCP server) *create, configure, and continuously update* dashboards. Work happening elsewhere — a long task, a research run, a build, a tracked metric — gets surfaced on the user's canvas by an agent, live, without the user lifting a finger. This is the main reason the feature exists.

2. **The prerequisite — effortless human setup and updates.** The grail is worthless if the human can't trivially stand a dashboard up, wire what it shows, and edit values by hand. **If user interaction is awkward, the feature is dead on arrival.** So every design choice is judged twice: *"can Claude drive this cleanly?"* **and** *"can the user do it in a few clicks?"* When those two pull apart, the human-ease requirement wins for the initial build, because it gates everything.

**A third, reinforcing motivation:** beyond Claude, *arbitrary external scripts* — cron jobs, CI pipelines, monitoring probes, scrapers — should be able to call the same API periodically to push updates into dashboards. This needs no special handling on its own: as long as the design stays API-centric, an external script is just another caller of the value-write endpoint. It does, however, harden one requirement — the write path must be **stable, addressable, and fully usable headless** (no app UI, callable from outside the app's process).

A useful way to hold it: **the dashboard system is one model behind one API, written by several clients** — the user's own UI, the MCP server (for Claude), and arbitrary external scripts. The MCP server is just the API wearing an agent-friendly face; an external cron job is the same API with no face at all. Everything below stays deliberately **API-centric** so that any of these is a first-class way to feed a panel.

---

## 2. What a Dashboard Panel Is

A **Dashboard Panel** is a new card type on a canvas, alongside Task, Note, and Group. Unlike those, it carries no intrinsic content of its own — it is a **presentation surface** for structured data that is *collected and updated elsewhere* (by the user, the API, or Claude).

Placement and behavior follow the existing model:

- It is a **Layout Item** (**P3**): positioned and sized on a canvas, with a `Layout` like any card.
- It is **not** a Canvas Host (Q1): a dashboard does not own a nested canvas. It is a leaf, like a Note. *(If we later want "drill into a dashboard for detail," that's a decision to revisit.)*
- It works on **any** canvas — project or task — with no special-casing (**P2**, recursive uniformity).
- Its arrangement carries meaning and is preserved exactly (**P0/P1**); the new toolbar (§7) exists precisely to serve spatial recall of dashboards.

Think of it as a small, configurable widget: a status tile, a progress bar, a key/value readout, a short list, a counter — composed from a few primitives and fed by an external source.

Crucially, the **data a panel shows is not stored in the panel.** It lives separately as reusable **data definitions** (§3) — standalone, project-scoped metrics — so the same metric can appear on many panels and update everywhere at once from a single broadcast.

---

## 3. How It Works — Two Separate Concerns: Data & Display

The model splits into **two independently-addressable resources**, each fully accessible by API:

- **Data definitions** — the *data layer*. A data definition is a standalone, project-scoped metric with a unique id; its current value lives inside it. It is the single source of truth for that metric and what every driver (user, API, scripts, MCP) reads and writes.
- **Dashboards** — the *presentation layer*. A dashboard is a canvas item whose config is an ordered list of **widgets**; each widget *references* a data definition by id and dictates how to display it.

> Why split them: a metric is defined and updated **once**, in one place, yet can be shown by **many** widgets across many dashboards. An update to a data definition broadcasts over Socket.IO and every referencing widget re-renders from that single broadcast — no per-widget data, no duplication, no drift. An agent updates *a metric* and every display of it follows.

### 3.1 Data definitions (the data layer)
A **data definition** is its own resource (its own collection, scoped to a project), holding both a metric's definition and its current value:
- a **unique `id`** — unique **per project** (Q2/Q11); the stable address everything uses to read or write this metric. API/MCP/script calls reference it as `(projectId, dataId)`.
- a **value type** — `number | text | boolean | enum | timestamp | list | …`;
- the **current `value`** — lives **inside** the definition (Q3); this is what gets updated and broadcast;
- optional **data-intrinsic metadata** — unit, natural min/max, enum options, etc.

Setting a data definition's value is the **hot path** (user edit, API, MCP, or script), and each update is **broadcast over Socket.IO** keyed by `(projectId, dataId)`.

### 3.2 Dashboards & widgets (the presentation layer)
A dashboard's config is an **ordered list of widgets** (a.k.a. control elements) — each the atomic, component-backed element on the panel. A widget binds a data definition to a display:
- a **unique `id`** — unique **within its dashboard**; identifies this widget instance for config edits (§3.6);
- a **`dataId`** — the data definition this widget shows (must resolve within the same project);
- a **`type`** — which display/control component renders it (`number | progress | status | text | list | toggle | gauge | …`), drawn from a fixed enum (§3.5);
- a **`label` and/or `icon`** — either may identify the widget; an `icon` (PrimeIcons) keeps panels compact so text isn't required for everything;
- display **options** — format, color thresholds, etc., specific to this widget instance.

The same `dataId` may be referenced by any number of widgets, on the same or different dashboards; all show the same value and update together.

### 3.3 Interaction & editability
A widget may be **editable**. Editing an editable widget writes to the **referenced data definition's value** (never to the widget) — so a hand edit flows to the same place an API write would, and every other widget showing that metric updates from the same broadcast.
- **editable?** read-only widgets are driver-fed; editable widgets expose an input control;
- the **input control** (text box, number, toggle, select, slider) matches the data's value type;
- optional **actions** — buttons a widget exposes (e.g. "reset", "increment"), operating on the referenced data definition.

### 3.4 Illustrative shapes (to be refined)

```ts
// --- Data layer: a standalone, project-scoped metric (its own collection) ---
interface DataDefinition extends DbEntity {
    projectId: ObjectId;
    id: string;                     // UNIQUE per project — the address for API/MCP/scripts/Socket.IO
    valueType: DataValueType;       // 'number' | 'text' | 'boolean' | 'enum' | 'timestamp' | 'list'
    value: DataValue;               // the current value lives HERE (Q3)
    options?: DataDefinitionOptions; // unit, natural min/max, enum options, …
}

// --- Presentation layer: a canvas item (its own collection) ---
interface Dashboard extends DbEntity {
    projectId: ObjectId;
    parentTaskId?: ObjectId;        // canvas placement; scoped by projectId + parentTaskId, like other items
    ancestorTaskIds: ObjectId[];
    layout: Layout;                 // it's a leaf Layout Item (Q1)
    title: string;
    key: string;                    // UNIQUE per project; a dashboard is addressed as (projectId, key)
    config: DashboardConfig;        // widgets only — NO values are stored here
}

interface DashboardConfig {
    widgets: DashboardWidget[];     // ordered; each is a standalone display/control component
}

interface DashboardWidget {
    id: string;                     // UNIQUE within the dashboard; identifies this widget instance
    dataId: string;                 // references a DataDefinition.id in the same project
    type: DashboardWidgetType;      // selects the component that renders it (fixed enum — §3.5)
    label?: string;                 // optional — a widget may identify by icon alone
    icon?: string;                  // optional PrimeIcons name (FontAwesome may be added later)
    editable: boolean;              // if true, user edits write THROUGH to the referenced DataDefinition
    options?: DashboardWidgetOptions; // format, thresholds, … (display-only)
}

// Fixed enum (Q4) — grown deliberately; each value maps 1:1 to a registered component (§3.5).
enum DashboardWidgetType {
    Number   = 'number',
    Progress = 'progress',
    Status   = 'status',
    Text     = 'text',
    List     = 'list',
    Toggle   = 'toggle',
    Gauge    = 'gauge',
}
```

### 3.5 Widgets are self-contained components

Every widget type — a raw number readout, a progress bar, a list, a status pill, a toggle, and so on — is its **own Angular component** that knows how to render (and, when editable, edit) one widget given its config and the current value of its referenced data definition. The dashboard shell never hard-codes a widget: it walks `config.widgets` and, for each, resolves the component registered for that widget's `type` (a `DashboardWidgetType` enum value), handing it the widget config plus the referenced metric's value.

- **Adding a display type is deliberate but small (P7, Q4):** add the enum value, write the component, register it under that value — it then becomes available in the setup UI and legal in a config, with no changes to the shell, API, or data model.
- **One registry, three consumers:** the same enum/registry feeds the setup UI (what you can add), the renderer (what draws each widget), and config validation (which `type`s are legal).
- **Icons, not just text:** each component receives the widget's `icon`, so panels can identify widgets by icon alone (PrimeIcons now; FontAwesome possibly later).

### 3.6 IDs & uniqueness (data ids and widget ids)

There are two id spaces, both **immutable once created** (Q14) and both enforced by the server:

- **Data-definition `id`** — unique **per project** (Q2/Q11). It is the address for all value reads/writes and the Socket.IO broadcast key. Creating or updating a data definition with an id already used in that project is rejected with **`409 Conflict`**.
- **Widget `id`** — unique **within its dashboard**; identifies a widget instance for config edits. A config create/update that would introduce a duplicate widget id within the dashboard is rejected with **`409 Conflict`**, applying none of it (no partial writes).
- A widget's **`dataId` must resolve** to a data definition in the same project; a config referencing an unknown metric is rejected (e.g. `422`).
- The setup UI validates all of this live so the user sees a collision or bad reference before submitting, but the **server checks are authoritative** — they also guard API/MCP/script callers that never touch the UI.

---

## 4. The API and Its Clients

The model is exposed as **two API resources**, both fully readable and writable: **data definitions** (addressed as `(projectId, dataId)`) and **dashboards** (addressed as `(projectId, key)`). The **hot path is a value write to a data definition** — set one metric's value by `(projectId, dataId)` — which broadcasts to every widget that references it. Dashboards and data definitions are also created and updated as whole declarative configs. Everything that drives the system is a **client** of this one API:

| Client | How it writes | Notes |
| ------ | ------------- | ----- |
| **User UI** | Inline edits on editable widgets (which write through to the referenced data definition); add/delete widgets and define metrics via setup surfaces. | The prerequisite goal (§1). Must be quick and obvious. |
| **External scripts / automation** | Periodic value writes to **data definitions** by `(projectId, dataId)` — cron jobs, CI, monitors, scrapers. | A co-motivation (§1). The write path must be usable **headless**, from outside the app. |
| **MCP server (Claude)** | Agent tools wrapping the same operations (§8): manage data definitions and dashboards, and set metric values. | The grail (§1). |

### 4.1 Reconciliation & live updates
- **Last-write-wins** (Q5) — single-user app, no merge complexity needed.
- **Updates appear live via Socket.IO** (Q6). A value write to a data definition broadcasts keyed by `(projectId, dataId)`; every widget referencing that metric — on any open canvas — patches in place. Because data is shared, one broadcast updates **all** displays of the metric at once.

### 4.2 Validation & conflicts
- **Data-definition create/update:** the `id` must be unique within the project; a duplicate returns **`409 Conflict`** (see §3.6).
- **Dashboard config create/update:** widget `id`s must be unique within the dashboard (duplicate → **`409 Conflict`**), and every widget `dataId` must resolve to a data definition in the project (unknown reference → `422`). A rejected request applies **nothing** — no partial writes.
- **Value writes:** the target `dataId` must exist and the value must conform to the metric's `valueType` (unknown id → `404`, malformed value → `422`).
- **IDs are immutable** (Q14): an "update" never renames a data-definition id or a widget id.

---

## 5. Effortless User Setup (the prerequisite goal)

This is the make-or-break surface. The user must be able to, in a few clicks:

1. **Create a dashboard** from the canvas context menu (like Add Task / Add Note / Add Group).
2. **Define metrics (data definitions)** — create a metric: `id`, value type, initial value, optional unit/options. Metrics live at the **project** level and can be reused by many widgets.
3. **Add widgets** — on the panel, an **"Add"** button creates a widget and the user supplies **all of its inputs**: pick the widget **type**, choose the **data definition** it shows (`dataId`), set its **label and/or icon**, and mark it editable. A **"Delete"** button removes a widget. The panel previews live.
4. **Edit values** — for editable widgets, type/toggle/select right on the card; the edit writes through to the referenced metric and updates everywhere it's shown.
5. **Get the address** — the `projectId`, the dashboard's `key`, and each metric's `id` are visible/copyable, so the user (or a Claude prompt) can tell an agent exactly what to target.

Authoring is **form-based** in the UI (add/delete buttons, all inputs required per widget), while the **same configs are fully expressible as JSON over the API** (Q7) — the API path is how Claude and scripts author.

---

## 6. Templates / starter panels (optional, aids both goals)

A small set of **starter configs** (e.g. "Status tile", "Progress bar", "Key/Value list", "Counter") lets a user — or Claude — stand up a common panel without hand-defining every widget. Templates are just pre-baked widget configs (a template may also create the data definitions it needs). They ship in **phase 1** (Q10) — they directly serve the "few clicks" bar and give the MCP server clean, named starting points.

---

## 7. Dashboard Toolbar (auto center/zoom)

**Any canvas that contains at least one dashboard automatically grows a toolbar at the top of the screen** with a button per dashboard for quick centering.

- It appears only when dashboards are present on the current canvas, and shows **one button per dashboard** (labeled by title), added and removed **dynamically** as dashboards come and go.
- Clicking a button **centers and fits** the viewport on that dashboard — that is the only action for now (Q8): no "fit all", no fixed-zoom option. It builds directly on the existing `ViewportService` (`zoomToFit` / screen↔canvas conversions already exist).
- This is a spatial-recall aid (**P0/P1**): dashboards are glance-at surfaces, and you want to jump to one instantly without hunting.

---

## 8. The MCP Server (the grail)

An MCP server exposes the dashboard operations as agent tools so Claude can author and feed dashboards directly. It is a **thin wrapper over the REST API** — no separate logic, so the two never drift.

Illustrative tool surface (to be refined):

| Tool | Purpose |
| ---- | ------- |
| `list_data_definitions` | Enumerate a project's metrics (`id`, value type, current value) so Claude can discover what's available to show or update. |
| `set_data_value` | **The hot path** — set a metric's value by `(projectId, dataId)`; broadcasts to every referencing widget. |
| `create_data_definition` / `update_data_definition` | Define or redefine a metric. Duplicate `id` in the project → `409`. |
| `list_dashboards` / `get_dashboard` | Enumerate dashboards, or read one by `(projectId, key)` — widget configs and the metrics they reference. |
| `create_dashboard` / `update_dashboard_config` | Author a dashboard's widgets (declarative). Duplicate widget `id` → `409`; unknown `dataId` → `422`. |

Design implications this places on the data model (so the MCP fit is clean):
- **Addressability** — stable, human-meaningful handles scoped by project: a metric is `(projectId, dataId)`, a dashboard is `(projectId, key)`, and a widget is identified by its `id` within a dashboard. Claude sets "the `build-status` metric in project X," never an ObjectId it must look up.
- **Data, not widgets, is the update target** — because metrics are shared, an agent updates a *metric* once and every widget showing it follows; it need not know where the metric is displayed.
- **Declarative config** — both a data definition and a dashboard's widgets are each expressible as one JSON object Claude can author and send whole.
- **Conformant, conflict-safe writes** — value writes are validated against the metric's `valueType`; config writes reject duplicate ids (`409`) or unknown `dataId`s (`422`) and apply nothing, so an agent can't silently corrupt or break addressing.
- **Discovery** — metrics and schemas are readable, so an agent can inspect before writing.

> Relationship to the LLM feature: the MCP server is a separate integration surface from the [`llm-feature-spec.md`](./llm-feature-spec.md) provider configuration. They may share nothing beyond living in the same app; noted here only so the two aren't conflated.

---

## 9. Add-on: Dashboard Groups / Views (future)

A later capability: collect several dashboards into a named **view** that can be popped up quickly — a saved arrangement you summon to see a related set at once (e.g. frame-and-zoom to just those panels, or a presentation overlay).

- A "view" is closer to a **saved viewport preset over a chosen set of dashboards** than to the existing **Group** container (§8.8 of the design spec), which physically reflows its members. Views are **stand-alone** — independent of Groups (Q9).
- Out of scope for the initial build; captured so the data model doesn't paint us into a corner (e.g. dashboards carrying stable `key`s makes them easy to reference from a view later).

---

## 10. Alignment with Existing Principles

| Principle | How the dashboard honors it |
| --------- | --------------------------- |
| **P0/P1 Spatial primacy** | Dashboards are positioned cards whose arrangement is preserved; the toolbar (§7) exists to serve spatial recall. |
| **P2 Recursive uniformity** | A dashboard behaves identically on a project canvas or any task canvas. |
| **P3 Container/Item duality** | Dashboard is a Layout Item (leaf), like a Note — not a Canvas Host (Q1). |
| **P5 One source of truth** | A metric is defined **once** as a data definition; widgets only reference it, so there's no duplicated data to drift. Dashboards and data definitions are plain persisted data; updates broadcast via Socket.IO. |
| **P7 Built for expansion** | Each widget type is a standalone component keyed by a `DashboardWidgetType` **enum** value — a new display type is a new enum value + component, added without touching the shell, API, or data model. The load-bearing principle for this feature. |
| **P8 Consistent presentation** | Widgets use design tokens; any overlay/editor uses `appendTo="body"`. |

---

## 11. Resolved Decisions

All confirmed by the user; kept here with rationale so the reasoning survives.

| # | Question | Resolution |
| - | -------- | ---------- |
| Q1 | Leaf item or canvas host? | **Leaf** Layout Item (like a Note). |
| Q2 | Scope of the dashboard `key`. | **Per project**; a dashboard is addressed as `(projectId, key)`. |
| Q3 | Where do metric values live? | **Inside the data definition's own config** — a resource **separate** from the dashboard. Widgets reference it by `dataId`; no values are stored on the dashboard. |
| Q4 | Widget-type set — enum or open registry? | **Enum** (`DashboardWidgetType`), grown deliberately; each value maps 1:1 to a component (§3.5). |
| Q5 | Reconciliation on concurrent writes. | **Last-write-wins.** |
| Q6 | Live-update transport. | **Socket.IO**, broadcast per `(projectId, dataId)`. |
| Q7 | Config authoring — form, JSON, or both? | **Both.** The API authors via JSON (for Claude/scripts); the user gets **add/delete** buttons per panel and supplies all inputs per widget. |
| Q8 | Toolbar behavior. | **Center + fit only**, with **one dynamically-added button per dashboard** on the canvas. No "fit all" for now. |
| Q9 | Views vs Groups. | **Stand-alone** — nothing to do with Groups. |
| Q10 | Starter templates in phase 1? | **Yes.** |
| Q11 | Collection scoping. | **`dashboards`** collection scoped by `projectId` + `parentTaskId` (like other items); **`data-definitions`** in a separate collection scoped by `projectId` only, so a metric is reusable anywhere in the project. |
| Q12 | Auth for off-host writes. | **No auth for now** — add only if a library requires it; avoid otherwise. |
| Q13 | Icon set. | **PrimeIcons** now; **FontAwesome** possibly later (pro license available), not yet. |
| Q14 | Are ids editable after creation? | **No** — data-definition ids and widget ids are **immutable**. |

---

## 12. Suggested Phasing

Ordered so the prerequisite (human ease) is proven before the grail (MCP) is built on top:

1. **Phase 1 — Data definitions + dashboards as first-class items.** The `data-definitions` and `dashboards` collections, the widget-type enum and a small set of widget components, starter templates (Q10), create-from-context-menu, **form-based setup (add/delete widgets, define metrics) + inline value editing**, render on the canvas. *(This phase alone must feel good to use — the gate for everything after.)*
2. **Phase 2 — Toolbar** (§7, center + fit per dashboard) and **live updates via Socket.IO** broadcast per `(projectId, dataId)`.
3. **Phase 3 — REST API** for both resources (data definitions and dashboards) — external reads and metric-value writes; the shared substrate for external scripts/automation and the MCP server.
4. **Phase 4 — MCP server** (the grail) wrapping the Phase-3 API.
5. **Phase 5 (add-on) — Dashboard Groups / Views** (§9).

> Phases 2 and 3 can swap or overlap; the toolbar is core enough that it shouldn't wait for the API.

---

## 13. References

- [`application-design.md`](./application-design.md) — canonical design (principles, item model, viewport, Socket.IO).
- [`implementation-decisions.md`](./implementation-decisions.md) — running log of build-time decisions.
- [`llm-feature-spec.md`](./llm-feature-spec.md) — separate integration surface; noted only to avoid conflation.
