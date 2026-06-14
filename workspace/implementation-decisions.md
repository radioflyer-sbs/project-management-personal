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

# Later sessions — grouping, multi-select, projection-to-parent (through 2026-06-13)

> Decisions from the sessions after the first pass. They add three feature areas the original design
> had deferred (multi-select, grouping, projection-to-parent) plus inline card editing. Canonical design
> is reflected in `application-design.md` §5.9–5.10, §6.4, §8.7–8.9, §11–12.

## D-IMPL-19 — Multi-select, multi-drag, multi-delete

**Decision:** Selection is a **set** held by the global `SelectionService`. Shift-click adds, Ctrl/Cmd-click removes, plain click replaces; a rubber-band drag on empty canvas selects overlapping items (with the same modifier semantics). Dragging any selected item moves the whole selection; a selected group carries its contained items, and items already inside a selected group are not double-moved. Delete removes the entire selection behind one confirmation.

**Why:** This was the original design's top "first expansion" candidate (old §14) and the foundation grouping builds on. Keeping it in the existing global selection service avoided a parallel state mechanism.

---

## D-IMPL-20 — Group is a container item, not a Canvas Host; reflow owns member layout

**Decision:** A `Group` (new `groups` collection) is an item placed on a canvas that arranges other items on the **same** canvas. It is not a Canvas Host — it owns no nested canvas (preserves **P3**). A reflow engine in `CanvasDataService.computeGroupLayout` overwrites each member's `Layout` into a uniform cell, packed in `itemIds` order, by layout mode: **vertical**, **horizontal**, or **wrap**. One group dimension is user-controlled (width for vertical/wrap, height for horizontal) and the other is auto-computed from the member/row count and persisted into `group.layout`.

**Why:** Grouping is a layout-and-membership concern, not a new level of nesting. Auto-sizing one dimension keeps groups tidy without violating **P1** for the items inside (their arrangement within the group is deterministic and user-driven via order).

---

## D-IMPL-21 — Group membership: `itemIds` authoritative + `groupId` back-ref + `preGroupLayout`

**Decision:** `Group.itemIds` is the authoritative, ordered membership list; each member task also stores `groupId`, and saves `preGroupLayout` on entry (restored on exit). Drop position during a drag computes the insertion index. Enter / exit / reorder / move-between-groups are distinct `CanvasDataService` operations, each persisting the group plus affected items. Because reflow packs in `itemIds` order, **`itemIds` is the members' visual reading order** — no geometry is needed to read a group internally.

**Why:** A single ordered source of truth (`itemIds`) makes both the visual reflow and the projection reading order (D-IMPL-26) fall out for free. `preGroupLayout` makes grouping non-destructive — leaving a group restores the item's prior free position.

---

## D-IMPL-22 — Group card hit-testing via `pointer-events`, not z-index

**Decision:** The group card root is `pointer-events: none`; only its title bar and resize handles set `pointer-events: auto`. The contained item cards therefore always receive their own clicks.

**Why:** Bringing a group to front raises its `zIndex` above the cards it contains, so a pointer-events-enabled root would swallow clicks meant for those cards (the cards became unselectable/unmovable inside horizontal groups). Decoupling hit-testing from stacking order fixes it permanently regardless of z-order.

---

## D-IMPL-23 — Inline card editing added (updates D6)

**Decision:** Task cards gained inline editing in addition to the Details Pane: double-click title/description to edit in place, an urgency picker dropdown in the status bar, a completion toggle, and a project-to-parent toggle. The Details Pane remains the complete editor.

**Why:** D6 originally deferred inline editing to keep one editing model. In practice, fast in-place edits on the card are worth the second surface; the pane is still authoritative and uniform across project/task/note.

---

## D-IMPL-24 — Projection to parent: opt-in flag + children embedded by aggregate

**Decision:** `Task.projectToParent` opts a child into its parent's card list. Canvas loads use a *with-projections* aggregate (`…/with-projections`) whose `$lookup` sub-pipeline embeds each task's opted-in **direct** children as `projectedChildren` (`_id`, `title`, `urgency`, `isComplete`), sorted by `projectionOrder`. The toggle lives in the Details Pane and as an inline button on the child card. Top-level tasks (parent = project) do not offer it.

**Why:** Embedding via aggregate avoids a second round-trip and delivers the parent card's list pre-ordered, so the client renders it with zero computation. Keeping it to 1st-level direct children keeps the parent card legible.

---

## D-IMPL-25 — `projectionOrder` reading-order algorithm (layout-derived, not urgency)

**Decision:** Order is computed from the parent canvas layout by a pure util (`projection-order.util.ts`): top-level units (loose items + each group as its bounding box) are banded into rows by **vertical overlap** (connected-components, threshold `ROW_OVERLAP_RATIO = 0.4`), rows run top→bottom and members left→right, with urgency only as a positional tiebreaker. A group **expands in place** into its `itemIds` order at the rank its box earned. Geometry runs only at the free top level — never inside a group.

**Why:** Mirrors how a person reads a page (rows top-down, left-right within a row), which is the user's stated intent for "priority." Connected-component banding avoids the non-transitive-comparator trap; deferring inside-group order to `itemIds` removes all ambiguity there.

---

## D-IMPL-26 — `projectionOrder` computed on write, coalesced per parent

**Decision:** `ProjectionOrderService.scheduleRecompute(parentTaskId)` is called by the task/group routers after writes that affect order (layout, grouping, urgency, create/delete) — never on view-state-only updates. It coalesces a transition's many writes via a trailing timer (per parent), then runs the pure algorithm and persists changed ranks with one bulk write. The read path is a plain `$sort` on `projectionOrder`.

**Why:** The ordering is graph/tree work — wrong for a Mongo pipeline, and wasteful on every read. Computing on write, coalesced, runs it at most once per layout transition (the user's explicit constraint) and keeps reads trivial. The recompute's own writes use a dedicated bulk path, so they don't re-trigger it.

---

## D-IMPL-27 — Completion toggles on cards and projected rows; optimistic projected-child patch

**Decision:** Completion is toggleable from (a) the card's status bar (a circle that fills to a green check) and (b) each row of a parent's projected list. Completed projected children render struck-through, color-neutralized, with a check icon. The projected-row toggle persists the child task directly (it isn't loaded in the grandparent view) and optimistically patches the parent's embedded `projectedChildren` for instant feedback.

**Why:** Lets a task be completed without opening the Details Pane, in both the place you see the card and the place you see its summary. Toggling completion is deliberately *not* an order input (it never triggers a projection recompute) — consistent with D5 (completion never cascades).

---

## D-IMPL-28 — Card flex layout: description fills, projected list shrinks & scrolls

**Decision:** On a card, the description region fills free space (and has a small min-height floor) while the projected-children list is the element that shrinks when the card is short: it scrolls (scrollbar hidden) and shows a bottom fade + chevron when clipping. The status bar stays pinned to the bottom. Overflow is detected with a `ResizeObserver` (card resize mutates height via direct DOM, outside Angular change detection), with state updates deferred to avoid `ExpressionChangedAfterItHasBeenCheckedError`.

**Why:** Before this, a long projected list squeezed the description out and pushed the status bar. Making the list the shrink target keeps the description readable and the status bar anchored, with a clear "more below" affordance.

---

## D-IMPL-29 — DeletionService is the sole entry point for all destructive actions

**Decision:** Every entity type (project, task, note, group, dashboard) routes its delete through `DeletionService`. Each method follows the same contract:

```
deleteX(id: string, label: string, onSuccess: () => void): void
```

The service shows the PrimeNG confirmation dialog, calls the entity's API client on accept, calls `selection.clear()`, then fires `onSuccess`. The caller's `onSuccess` removes the item from local state only — it never calls the API a second time. `window.confirm` and ad-hoc `confirm()` calls are explicitly prohibited for destructive actions.

**Why:** Before this was enforced, `DashboardCardComponent.deleteDashboard()` used a raw `window.confirm()` and emitted an event that triggered `CanvasDataService.removeDashboard()`, which made its own API call. This gave dashboards an inconsistent deletion experience (browser dialog instead of PrimeNG modal) and a double API call. Routing through `DeletionService` gives every entity type the same styled modal, the same selection-clear behavior, and a single API call.

**Pattern for adding new entity deletions:** inject `DeletionService`, add a method following the pattern above (injecting the entity's API client), and ensure the caller's `onSuccess` only mutates local state.

---

## Open Questions for User Review

1. **Resize minimum enforcement**: When a card is resized below `MIN_ITEM_WIDTH`/`MIN_ITEM_HEIGHT`, the resize is clamped. Should the card "snap back" visually (yes, per spec) or also show an error? Currently: silently clamps.

2. **Project list card layout**: Implemented as a responsive card grid (3 columns on wide screens, 2 on medium, 1 on narrow). Cards show name, truncated description, and action buttons.

3. **Task urgency in Details Pane**: Urgency is a PrimeNG Dropdown with all six values. Default on new task: `Normal`.

4. **Note body background**: ColorPicker is only shown for Notes. Tasks do not have a user-choosable background (urgency controls it).
