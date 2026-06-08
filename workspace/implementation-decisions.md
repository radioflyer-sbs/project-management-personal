# Implementation Decisions Log

> Decisions made during the first implementation pass (2026-06-07).
> The user will review these and update canonical design documents as needed.
> Each entry states what was decided, why, and what it affected.

---

## D-IMPL-01 — Context menu is a custom positioned overlay (not PrimeNG ContextMenu)

**Decision:** The right-click context menu is implemented as a custom absolutely-positioned `div` rather than PrimeNG's `p-contextmenu` component.

**Why:** PrimeNG's ContextMenu captures `mousedown` in ways that interfere with middle-mouse-button panning detection. A plain div overlay (shown/hidden with position computed from `clientX/clientY`) has zero interference with canvas event handling.

**First-class extensibility:** The context menu component accepts an `items: ContextMenuItem[]` input, so adding new commands later is a one-line change in the parent component.

---

## D-IMPL-02 — Canvas host services are component-scoped (provided in CanvasHostComponent)

**Decision:** `ViewportService`, `CanvasDataService`, and `CanvasInteractionService` are listed in the `providers` array of `CanvasHostComponent`, not `providedIn: 'root'`.

**Why:** Each canvas (project canvas, any task canvas) needs its own independent pan/zoom state, data set, and interaction state. Angular DI creates a new instance per component host when listed in `providers`.

**Effect:** Navigating between canvases destroys the old instances and creates fresh ones, so stale data cannot bleed across.

---

## D-IMPL-03 — SelectionService is global (`providedIn: 'root'`)

**Decision:** There is one global `SelectionService` rather than a per-canvas one.

**Why:** There is exactly one Details Pane visible at any time (it's part of CanvasHostComponent's template), and only one canvas is active at a time. A global service means `DetailsPaneService` and `DeletionService` can inject it without indirection. The CanvasHostComponent clears the selection on `ngOnDestroy` to prevent stale references.

---

## D-IMPL-04 — Task chain in URL parsed from `router.url` string

**Decision:** The task id chain (`/projects/:id/tasks/t1/t2/t3`) is extracted by splitting `router.url` on `/tasks/` and splitting the right half by `/`.

**Why:** Angular's `**` wildcard route inside a child route does not surface the matched segments as a named param. Parsing `router.url` directly is simple, reliable, and avoids an extra route-data mechanism. `NavigationService` owns this logic; no component touches it.

---

## D-IMPL-05 — New item (task/note) placed at right-click canvas position, not viewport center

**Decision:** When the user right-clicks and chooses "Add Task" or "Add Note", the new item's top-left corner is placed at the canvas-space coordinates corresponding to the right-click position.

**Why:** The right-click already tells us exactly where the user is pointing. Placing the item there is more spatial (P1) than snapping to an arbitrary viewport center.

**Default size:** 240 × 140 canvas-space units.

---

## D-IMPL-06 — New item created with placeholder title; Details Pane auto-opens

**Decision:** A newly created task or note gets the title "New Task" / "New Note" and an empty description. It is immediately selected, causing the Details Pane to focus its title field.

**Why:** The user's answer was "Tasks and Notes should just be edited in the editor pane, assuming there's enough information to create the item." A placeholder title is enough information to persist a valid document.

---

## D-IMPL-07 — Canvas host has an "Edit" toolbar button that opens a dialog

**Decision:** A small toolbar above the canvas area shows the host name and an "Edit" button. Clicking it opens a PrimeNG Dialog to edit the canvas host's name and description (for Projects: name + description; for Tasks: title + description).

**Why:** The user said "we should be able to edit the two properties through a dialog too. It should be activated with a button that sits near the delete button." The toolbar also holds the Delete button for the host.

---

## D-IMPL-08 — Resize handles are 8-point (4 edges + 4 corners)

**Decision:** Each card has 8 resize handles: nw, n, ne, e, se, s, sw, w. Dragging a corner resizes two dimensions; dragging an edge resizes one. The cursor CSS changes to the appropriate resize cursor.

**Why:** This matches the "sizeable … like a window within MS Windows" requirement from the vision.

---

## D-IMPL-09 — Move & resize use `pointermove`/`pointerup` on `document`

**Decision:** When a drag starts (move or resize), listeners for `pointermove` and `pointerup` are attached to `document`, not to the card element. They are removed on `pointerup`.

**Why:** Using `document`-level listeners means the drag continues correctly even when the pointer leaves the card boundary at high velocity, which is standard for drag implementations.

---

## D-IMPL-10 — `zIndex` bumped to `Date.now()` on mousedown (bring to front)

**Decision:** When the user clicks (mousedown) a card, its `layout.zIndex` is updated to the current Unix timestamp in milliseconds.

**Why:** `Date.now()` guarantees uniqueness without needing to track a global counter. The spec says "bringing an item forward updates its zIndex." This is the simplest implementation with zero coordination overhead.

---

## D-IMPL-11 — API clients split into ProjectApiClient, TaskApiClient, NoteApiClient

**Decision:** Instead of one monolithic `ClientApiService`, three focused API clients are created: `ProjectApiClient`, `TaskApiClient`, `NoteApiClient`. `ClientApiService` is kept as a thin re-export shim.

**Why:** The design spec (§11.3) notes this may grow. Three focused clients are cleaner and satisfy single responsibility (P7) from the start.

---

## D-IMPL-12 — ViewState persistence debounced to 1 second

**Decision:** Pan and zoom changes trigger a debounced save (1000 ms) to the backend via the canvas data service.

**Why:** The spec says "debounced to avoid write storms." 1 second is a reasonable balance between spatial-memory fidelity (P1) and write volume.

---

## D-IMPL-13 — Details Pane shows host properties when nothing is selected, not a "nothing selected" placeholder

**Decision:** When the user clicks empty canvas (clears selection), the Details Pane immediately switches to showing the current canvas host's editable properties.

**Why:** The vision doc says "When nothing is selected, then the project information shows on the edit pane." This behavior avoids a useless blank state.

---

## D-IMPL-14 — Breadcrumb built from NavigationService; task labels loaded lazily

**Decision:** The breadcrumb shows project name + task titles for each id in the URL chain. Task titles for ancestor tasks are fetched individually (`GET /api/tasks/:id`) if not already in memory.

**Why:** The canvas only loads the current level's tasks. Ancestor task names need a lightweight fetch. This is a small cost and keeps the breadcrumb accurate without restructuring the data load.

---

## D-IMPL-15 — Note body background color defaults to off-yellow (`#fdf2c4`) ✅ confirmed

**Decision:** A new Note's `backgroundColor` defaults to `#fdf2c4` (same off-yellow as the Note header). The user can change it via a PrimeNG ColorPicker in the Details Pane.

**Why:** User preference — header and default body color matching gives notes a uniform appearance out of the box. The user can still override the body color freely.

---

## D-IMPL-16 — Completion visual: opacity 0.55 + strikethrough title + checkmark in header

**Decision:** A complete task card has `opacity: 0.55`, the title has `text-decoration: line-through`, and a small checkmark icon (PrimeIcon `pi-check`) appears in the header.

**Why:** The spec (§7.3) recommended "opacity reduction + strikethrough title + check indicator" as the cosmetic treatment. This implements that recommendation literally.

---

## D-IMPL-17 — Backend uses Zod for request body validation

**Decision:** All `POST` and `PUT` route handlers validate incoming JSON with Zod schemas. Invalid bodies return `400` with a structured error.

**Why:** The project standards require Zod validation. Schemas are defined inline in each router file.

---

## D-IMPL-18 — MongoDB indexes created in `system-setup.ts`

**Decision:** The recommended indexes from §6.2 are created in `systemInitialization()` using `createIndex` calls. They are safe to call on every startup (MongoDB is idempotent for existing indexes).

**Why:** Keeps index management in one place; works without a separate migration system.

---

## Open Questions for User Review

1. **Resize minimum enforcement**: When a card is resized below `MIN_ITEM_WIDTH`/`MIN_ITEM_HEIGHT`, the resize is clamped. Should the card "snap back" visually (yes, per spec) or also show an error? Currently: silently clamps.

2. **Project list card layout**: Implemented as a responsive card grid (3 columns on wide screens, 2 on medium, 1 on narrow). Cards show name, truncated description, and action buttons.

3. **Task urgency in Details Pane**: Urgency is a PrimeNG Dropdown with all six values. Default on new task: `Normal`.

4. **Note body background**: ColorPicker is only shown for Notes. Tasks do not have a user-choosable background (urgency controls it).
