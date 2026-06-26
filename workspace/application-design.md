# Project Management Application — Design Specification

> This document expands and formalizes [`application-details.md`](./application-details.md).
> Where that file captures the initial vision, this one is the **canonical design reference**:
> the design principles, the complete data model, the interaction rules, and the architectural
> decisions that drive implementation. When the two disagree, this document wins; when this
> document is silent, fall back to the vision in `application-details.md` and to the coding
> standards in `mean-stack-project-setup/references/project-standards.md`.

---

## 1. Purpose (The Prime Directive)

> **This application provides visually interactive task management focused on the user's spatial
> awareness and spatial memory to help organize information. It strives to enable strong strategies
> for grouping and categorizing task-based information.**

Every other rule in this document exists to serve that sentence. When a design choice is ambiguous,
resolve it in favor of (a) preserving the user's spatial arrangement and (b) keeping grouping
mechanisms open-ended and easy to extend.

---

## 2. Top-Level Design Principles

These are the hierarchical, app-specific rules that govern all architecture and feature work. They
are numbered so other documents and code comments can reference them (e.g. "per **P2**").

### P0 — Purpose is the highest authority
The prime directive in §1 outranks every other principle. A feature that improves spatial memory or
grouping power is worth complexity; a feature that does neither is suspect.

### P1 — Spatial primacy
Position and arrangement **carry meaning**. The application must preserve the exact arrangement the
user creates and **never auto-rearrange, auto-layout, or "tidy"** items. Position, size, and stacking
order are first-class data, persisted with the item. Returning to a canvas restores it exactly as it
was left — including pan and zoom (see §8.4).

### P2 — Recursive uniformity (fractal design)
A Task's canvas behaves **identically** to a Project's canvas. The same components, services, and
interactions apply at every depth. "If it works at one level, it works at all levels." This is the
strongest driver of code reuse in the app: there is one canvas implementation, not a project canvas
and a separate task canvas.

### P3 — Container / Item duality
Three structural roles define what may own what:

| Role            | Has a position in a parent canvas? | Hosts a canvas of children? | Types         |
| --------------- | ---------------------------------- | --------------------------- | ------------- |
| **Canvas Host** | —                                  | yes                         | Project, Task |
| **Layout Item** | yes                                | —                           | Task, Note    |
| **Both**        | yes                                | yes                         | **Task**      |

A **Project** is a Canvas Host only (the root canvas; it never sits inside anything).
A **Note** is a Layout Item only (it can be placed and moved, but never owns children).
A **Task** is both — a card inside its parent's canvas *and* a canvas for its own children.

### P4 — Load before show
A component does not render its primary content until the data backing it has fully resolved.
Loading/readiness is expressed through observables; use them to drive spinners, skeletons, and gates.

### P5 — One source of truth per concern
- **Application/UI state** lives in Angular services, exposed as observables. Components subscribe; they do not own non-trivial state.
- **Persistent data** lives in MongoDB as **plain data** — no observables, no class instances, no logic in stored shapes (see **P-RXJS**).
- **Navigation position** is owned by the **URL**. The breadcrumb and current canvas derive from the route, not from in-memory flags.

### P6 — Confirm, then commit permanently
Every destructive action is gated by a confirmation dialog. Once confirmed, deletes are **hard,
permanent, and cascading** (a delete removes all descendants — see §6.3). There is no soft-delete or
undo in the initial design.

### P7 — Built for expansion
New ways to group, categorize, and organize tasks and notes are **expected**. Core types carry stable
identifiers and structural metadata (see §5) so new grouping concepts can be layered on **without
reshaping existing data**. Prefer abstraction and purpose-built services over inline, one-off logic.

### P8 — Consistent presentation
Styling is centralized in design tokens (§9) and applied uniformly — including the elements that are
easy to forget, such as dialogs, drop-downs, and other overlays. Every PrimeNG component with an
`appendTo` property is set to `appendTo="body"`.

---

## 3. Glossary

| Term             | Meaning                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------- |
| **Canvas**       | The pannable, zoomable surface on which items are arranged. Belongs to a Canvas Host.    |
| **Canvas Host**  | An entity that owns a canvas: a Project or a Task.                                       |
| **Item / Card**  | A positioned rectangle on a canvas: a Task or a Note.                                    |
| **Drill in**     | Double-clicking a Task to navigate into that Task's own canvas.                          |
| **Selection**    | The single item (or host) whose properties are shown in the Details Pane.                |
| **Details Pane** | The right-hand editor panel reflecting the current selection.                            |
| **Breadcrumb**   | The navigable trail (Project → Task → Task …) derived from the URL.                      |
| **Canvas-space** | The coordinate system in which item positions/sizes are stored, independent of zoom/pan. |
| **Screen-space** | Pixel coordinates in the browser viewport, after the canvas transform is applied.        |
| **View state**   | A canvas's saved pan offset and zoom level.                                              |

---

## 4. Conceptual Model Overview

```
Project  (root canvas host)
 ├── Task        (item on the project canvas; also a canvas host)
 │    ├── Task   (item on the parent task's canvas; also a canvas host)
 │    │    └── … recursively, indefinitely
 │    └── Note   (item on the parent task's canvas; leaf)
 └── Note        (item on the project canvas; leaf)
```

- A Task's **owner** is always a Project. A Task **optionally** has a parent Task.
  - No parent Task → the Task lives directly on the Project's canvas.
  - Has a parent Task → the Task lives on that parent Task's canvas.
- A Note follows the same placement rule (owned by a Project, optionally on a parent Task's canvas)
  but can never own children.

A third item type — the **Group** — was added after the initial design (see §5.9 and §8.8). A Group is a
labeled container placed on a canvas that visually collects items and arranges them in a chosen layout
direction. Groups are **organizational containers, not Canvas Hosts**: they do not own a nested canvas;
their members remain items on the *same* canvas, repositioned by the group's reflow engine.

---

## 5. Data Model

All persisted shapes are **interfaces** (no classes, no observables — **P5**, **P-RXJS**). They live
in `src/model/shared-models/` and are kept identical on client and server (server is source of truth).
`ObjectId` is imported from `mongodb` (a real type on the server; aliased to `string` in the browser).

### 5.1 Base entity

```typescript
import { ObjectId } from 'mongodb';

/** Fields common to every persisted entity. */
export interface DbEntity {
    /** Primary key. */
    _id: ObjectId;
    /** Creation timestamp (UTC). */
    createdAt: Date;
    /** Last-modification timestamp (UTC). */
    updatedAt: Date;
}
```

### 5.2 Layout (embedded value type)

`Layout` is **not** a collection; it is embedded in each Layout Item.

```typescript
/** Position and size of an item within its parent canvas, in canvas-space units. */
export interface Layout {
    /** Left edge, canvas-space. */
    x: number;
    /** Top edge, canvas-space. */
    y: number;
    /** Width, canvas-space units (≥ MIN_ITEM_WIDTH). */
    width: number;
    /** Height, canvas-space units (≥ MIN_ITEM_HEIGHT). */
    height: number;
    /** Stacking order within the canvas; higher renders on top. */
    zIndex: number;
}
```

### 5.3 Canvas view state (embedded value type)

Persisted on each Canvas Host so a canvas reopens exactly where the user left it (**P1**).

```typescript
/** Saved pan/zoom for a canvas host. */
export interface CanvasViewState {
    /** Pan offset X, screen-space pixels at zoom = 1. */
    panX: number;
    /** Pan offset Y, screen-space pixels at zoom = 1. */
    panY: number;
    /** Zoom factor; 1 = 100%. Clamped to [ZOOM_MIN, ZOOM_MAX]. */
    zoom: number;
}
```

### 5.4 Project

```typescript
/** A self-contained data set: the root canvas host. */
export interface Project extends DbEntity {
    /** Display name. */
    name: string;
    /** Free-form description, arbitrary length. */
    description: string;
    /** Saved pan/zoom of the project's own canvas. */
    viewState?: CanvasViewState;
}
```

### 5.5 Task

```typescript
import { TaskUrgency } from './task-urgency.enum';

/** A recursive, completable container of sub-tasks and notes. */
export interface Task extends DbEntity {
    /** Owning project (denormalized on every descendant for fast project-scoped queries). */
    projectId: ObjectId;
    /** Direct parent task; undefined means the task sits directly on the project canvas. */
    parentTaskId?: ObjectId;
    /** Ordered ancestor task ids, root-most first. Empty when directly under the project.
     *  Enables subtree queries and cascade deletes without recursive lookups. */
    ancestorTaskIds: ObjectId[];

    /** Bold, prominent title shown on the card. */
    title: string;
    /** Body description. **Markdown** (links, bold/italic, lists, headings); rendered on the
     *  card and editable with a markup/preview toggle (§8.11). Visually clipped if it overflows. */
    description: string;
    /** Drives the card's background/border color (see §7.2). */
    urgency: TaskUrgency;
    /** Completion flag. */
    isComplete: boolean;
    /** Optional due date/time. When set, the card shows a live countdown (§8.12). */
    dueDate?: Date;

    /** Position/size of this task as a card on its parent canvas. */
    layout: Layout;
    /** Saved pan/zoom of this task's own (child) canvas. */
    viewState?: CanvasViewState;

    // --- Grouping (this task may belong to a Group on its canvas; §5.9, §8.8) ---
    /** Id of the Group this task is a member of, if any. */
    groupId?: string;
    /** The task's free layout from before it joined a group; restored on exit. */
    preGroupLayout?: Layout;

    // --- Projection to parent (§5.10, §8.9) ---
    /** When true, this task surfaces in its parent task's projected-children list. */
    projectToParent?: boolean;
    /** Reading-order rank among the parent's direct children, derived from the parent's
     *  canvas layout and computed server-side on layout changes. Lower sorts first. */
    projectionOrder?: number;
    /** DERIVED, not stored on this document. Populated only when this task is loaded as a
     *  parent via the "with-projections" aggregate (§6.4): the opted-in direct children,
     *  ordered by `projectionOrder`. */
    projectedChildren?: ProjectedChild[];
}
```

### 5.6 Note

```typescript
/** A single-level post-it: title + details, no children. */
export interface Note extends DbEntity {
    /** Owning project. */
    projectId: ObjectId;
    /** Canvas this note lives on; undefined means the project canvas. */
    parentTaskId?: ObjectId;
    /** Ordered ancestor task ids, root-most first; empty when on the project canvas. */
    ancestorTaskIds: ObjectId[];

    /** Title shown in the always off-yellow header. */
    title: string;
    /** Body content. **Markdown**, rendered/edited exactly like a Task description (§8.11). */
    details: string;
    /** User-chosen body background color (CSS color string). Header stays off-yellow. */
    backgroundColor: string;

    /** Position/size on its parent canvas. */
    layout: Layout;
}
```

### 5.7 Urgency enum

```typescript
/** Task urgency. Drives card color only (§7.2). Order is ascending time-pressure,
 *  with LongTermGoal as a distinct low-pressure category. */
export enum TaskUrgency {
    LongTermGoal = 'long-term-goal',
    Low = 'low',
    Normal = 'normal',
    Important = 'important',
    Urgent = 'urgent',
    Immediate = 'immediate',
}
```

### 5.8 Shared constants

```typescript
/** Minimum card dimensions in canvas-space units. */
export const MIN_ITEM_WIDTH = 160;
export const MIN_ITEM_HEIGHT = 100;

/** Default sizes for newly-created items and groups. */
export const DEFAULT_ITEM_WIDTH = 240;
export const DEFAULT_ITEM_HEIGHT = 140;
export const DEFAULT_GROUP_WIDTH = 420;
export const DEFAULT_GROUP_HEIGHT = 340;

/** Group reflow metrics (canvas-space units). */
export const GROUP_TITLE_HEIGHT = 36;
export const GROUP_PADDING = 12;
export const GROUP_CARD_GAP = 8;
export const GROUP_ITEM_HEIGHT = DEFAULT_ITEM_HEIGHT;
export const GROUP_ITEM_WIDTH  = DEFAULT_ITEM_WIDTH;

/** Zoom bounds and step. */
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 4;
export const ZOOM_STEP = 1.1; // multiplicative per wheel notch
```

### 5.9 Group

A Group is a labeled container that collects items on a canvas and reflows them in a chosen direction
(§8.8). It is a persisted entity in its own `groups` collection. Membership is the **authoritative
ordered list** `itemIds`; each member task also back-references the group via `Task.groupId`.

```typescript
export type GroupLayoutDirection = 'vertical' | 'horizontal';

/** A labeled container that arranges other items on the same canvas. */
export interface Group extends DbEntity {
    /** Owning project. */
    projectId: ObjectId;
    /** Canvas this group lives on; undefined means the project canvas. */
    parentTaskId?: ObjectId;
    /** Editable group label. */
    title: string;
    /** Position/size of the group box on its canvas. One dimension is user-controlled,
     *  the other is auto-computed from the member count (§8.8). */
    layout: Layout;
    /** Ordered ids of contained items. This sequence *is* the members' reading order. */
    itemIds: string[];
    /** Primary arrangement axis; defaults to 'vertical'. */
    layoutDirection?: GroupLayoutDirection;
    /** When true (horizontal only), members wrap into rows. */
    layoutWrap?: boolean;
}
```

### 5.10 ProjectedChild (derived, embedded)

Not a collection. This is the lightweight shape embedded into a parent `Task.projectedChildren` by the
"with-projections" aggregate (§6.4). It is a read-only projection of a child task — never written back.

```typescript
/** A single opted-in child summarized on its parent's card (§8.9). */
export interface ProjectedChild {
    _id: ObjectId;
    title: string;
    urgency: TaskUrgency;
    isComplete: boolean;
}
```

---

## 6. Database Strategy

### 6.1 Collections

Three collections, related by `_id` references (per the vision). Register names centrally in
`src/model/db-collection-names.constants.ts` — never inline string literals.

| Collection | Holds               |
| ---------- | ------------------- |
| `projects` | `Project` documents |
| `tasks`    | `Task` documents    |
| `notes`    | `Note` documents    |
| `groups`   | `Group` documents (§5.9) |

> A `groups` collection was added with the grouping feature. Groups are scoped to a canvas exactly like
> items — by `projectId` and optional `parentTaskId` — so the same canvas-scoped query shapes apply
> (`{ projectId, parentTaskId: { $exists: false } }` for the project canvas, `{ parentTaskId }` for a task
> canvas). Group indexes are not yet created in `system-setup.ts`; at human scale (dozens of groups per
> canvas) this is acceptable, and mirroring the task/note indexes is the obvious step if it ever matters.

### 6.2 Relationships & indexes

- A Task/Note references its `projectId` (always) and `parentTaskId` (optional).
- `ancestorTaskIds` is the **materialized path** — the ordered list of all ancestor task ids. It is
  set on insert and rewritten if an item is ever re-parented. It exists to make two operations cheap:
  subtree reads and cascade deletes, without recursive round-trips.

Recommended indexes:

| Collection       | Index                               | Serves                            |
| ---------------- | ----------------------------------- | --------------------------------- |
| `tasks`, `notes` | `{ projectId: 1, parentTaskId: 1 }` | "load the items on this canvas"   |
| `tasks`, `notes` | `{ ancestorTaskIds: 1 }`            | "load / delete an entire subtree" |
| `tasks`, `notes` | `{ projectId: 1 }`                  | "everything in this project"      |

**Loading a canvas** (project or task) is one query per collection:
- Project canvas: `{ projectId, parentTaskId: { $exists: false } }`
- Task canvas: `{ parentTaskId: <taskId> }`

### 6.3 Cascade deletion (P6)

Deletion is hard and cascading. Using the materialized path, deleting a Task `T` is:

1. Delete all `tasks` where `ancestorTaskIds` contains `T._id`.
2. Delete all `notes` where `ancestorTaskIds` contains `T._id`.
3. Delete all `notes` where `parentTaskId === T._id` (direct notes; also covered by step 2 if their path includes `T`).
4. Delete `T` itself.

Deleting a **Project** deletes the project plus every `task` and `note` with that `projectId`.
Deleting a **Note** deletes just that note.

This multi-step process is owned by a dedicated server service (see §11.2), never duplicated in route
handlers (**P7**).

### 6.4 Projected children & reading order (supports §8.9)

A parent task's card lists the direct children that opted into projection (`projectToParent === true`).
Two server mechanisms make this cheap and correct:

- **Embedding (read path).** Loading a canvas uses a *"with-projections"* variant
  (`GET …/with-projections`) that runs a `$lookup` sub-pipeline per task to embed its opted-in direct
  children as `projectedChildren` (`_id`, `title`, `urgency`, `isComplete`), **sorted by
  `projectionOrder`**. The grandparent canvas thus receives each parent card's child list already
  ordered, with no client-side computation. `$lookup` preserves the sub-pipeline's sort order in the
  emitted array.

- **Reading order (write path).** `projectionOrder` is the rank of a child among **all** its parent's
  direct children (independent of the projection flag, so toggling projection never forces a recompute).
  It is derived from the parent canvas's 2-D layout by a pure, tested function and persisted per child
  via a single bulk write. The pass is triggered **on write** — coalesced per parent task (trailing
  debounce) so a transition's many layout writes collapse into one recompute that runs after they land.
  See §8.9 for the ordering algorithm and §11.2/§12.2 for the owning services.

---

## 7. Visual Representation

### 7.1 Card anatomy (Task and Note)

Both render as a resizable, positionable rectangle resembling an MS-Windows window:

```
┌────────────────────────────┐
│  Title (bold, prominent)   │  ← header
├────────────────────────────┤  ← horizontal divider
│  Description / details      │  ← body (truncated on overflow)
│  …                          │
└────────────────────────────┘
```

- **Header:** bold title. For a Task, the header tints with the urgency hue; for a Note, the header is
  always **off-yellow**.
- **Divider:** a horizontal border between header and body.
- **Body:** description (Task) or details (Note), rendered from **Markdown** (§8.11). Content is
  clipped if it does not fit; full content is available via selection in the Details Pane.
- **Border:** same hue as the background, one step darker.
- **Status bar (Task):** a bottom row of inline controls — completion toggle, urgency picker,
  due-date control + live countdown (§8.12), project-to-parent toggle (§8.9), and sub-task / note
  counts.
- **Resize/move:** like a desktop window — drag the body/header to move, drag edges/corners to resize,
  down to the minimums in §5.8.

### 7.2 Urgency color palette

Cards take their color from `TaskUrgency`. `LongTermGoal` sits outside the warm pressure ramp as a
distinct cool hue (it is aspirational, not time-pressured); `Low → Immediate` form a green→red ramp.
Text on all backgrounds uses `--color-text-on-card` for contrast. Define these as design tokens (§9).

| Urgency                  | Hue               | Background | Border (darker) |
| ------------------------ | ----------------- | ---------- | --------------- |
| Long Term Goal           | indigo / lavender | `#e4e3fb`  | `#7b73d4`       |
| Low                      | green             | `#dff0db`  | `#6aa564`       |
| Normal                   | neutral slate     | `#eceff2`  | `#94a1ae`       |
| Important                | amber             | `#ffe3c2`  | `#e0903c`       |
| Urgent                   | orange-red        | `#ffd0c2`  | `#dd5a36`       |
| Immediate                | red               | `#ffc4c4`  | `#d23838`       |
| **Note header (always)** | off-yellow        | `#fdf2c4`  | `#d9c65e`       |
| Card text                | —                 | `#2b2b2b`  | —               |

> These are the starting values requested in `application-details.md`. They are tokens, so re-theming
> is a one-file change.

### 7.3 Completion & selection states

- **Complete task:** visually de-emphasized — the implemented treatment is `opacity: 0.55`, a
  strikethrough title, and a `pi-check` indicator in the header (D-IMPL-16).
- **Toggling completion:** completion has a direct toggle on the card's status bar (a circle that fills
  to a green check when complete), so a task can be completed without opening the Details Pane. Completed
  children also render struck-through and color-neutralized in their parent's projected list, with their
  own inline toggle there (§8.9).
- **Completion is per-item and never cascades (D5).** Completing a task changes only that task's
  `isComplete`; its sub-tasks and notes are untouched. This keeps the user's mental model exact and
  makes completion losslessly reversible — un-completing a task later restores the subtree to the
  identical state it had before.
- **Selected item(s):** an accent outline plus resize handles. Selection is **multi-item** (§8.7); the
  Details Pane reflects a single primary selection, falling back to the canvas host when nothing is
  selected.

---

## 8. Canvas & Interaction

### 8.1 Coordinate system

- Items are stored in **canvas-space**: origin `(0, 0)` at the canvas's top-left, `+x` right, `+y` down,
  one unit = one pixel at `zoom = 1`. An item's `Layout` is in canvas-space and is **independent of**
  the current pan/zoom (**P1**).
- The viewport applies a single transform `screen = (canvas * zoom) + pan`. Conversions between the two
  spaces are owned by the viewport service (§11.1), not scattered through components.

### 8.2 Pan

- **Middle-mouse-button drag** pans the canvas.
- Panning updates the live view state and is persisted to the host's `viewState` (debounced).

### 8.3 Zoom

- **Mouse wheel** zooms, by `ZOOM_STEP` per notch, clamped to `[ZOOM_MIN, ZOOM_MAX]`.
- Zoom is **centered on the cursor**: the canvas point under the pointer stays fixed on screen while
  the surface scales around it.

### 8.4 View-state persistence (derived from P1)

Because spatial memory is the point, each canvas remembers its pan and zoom. On entering a canvas,
restore `viewState` if present; otherwise start at a sensible default (zoom = 1, pan framing existing
content, or origin if empty). Persist changes debounced to avoid write storms.

### 8.5 Selection rules

- **Single-click** an item → select it (Details Pane shows its properties).
- **Shift / Ctrl-click** and **rubber-band drag** extend or modify a multi-selection (§8.7).
- **Click empty canvas** → clear selection; the Details Pane falls back to the **current Canvas Host**
  (the project on a project canvas; the task on a task canvas).
- **Double-click a Task** → drill in (navigate to that task's canvas).
- Notes cannot be drilled into.

### 8.6 Moving & resizing

- Drag to move; drag edges/corners to resize (min sizes per §5.8).
- On drag/resize **end**, persist the new `Layout` via the canvas service. In-flight changes update
  local observable state immediately for responsiveness (**P4/P5**).
- Bringing an item forward updates its `zIndex`.

### 8.7 Multi-selection & multi-drag

Selection is a set, not a single item (this fulfills the first expansion anticipated in the original §14).

- **Shift-click** adds to the selection; **Ctrl/Cmd-click** removes; a plain click selects just one.
- **Rubber-band**: dragging on empty canvas draws a selection rectangle; items overlapping it are
  selected (Shift adds, Ctrl removes, plain replaces).
- **Multi-drag**: dragging any selected item moves the whole selection together. A selected **group**
  carries all its contained items; items already inside a selected group are not moved twice.
- **Multi-delete**: a single confirmation (**P6**) deletes every selected item, with a message that reads
  naturally for one or many.

### 8.8 Grouping (Group items)

A **Group** (§5.9) collects items on a canvas and arranges them — the first concrete "grouping strategy"
called for by **P0**. Grouping is a layout-and-membership concern; it does **not** create a nested canvas
(groups are not Canvas Hosts, **P3**).

- **Layout modes** (`layoutDirection` + `layoutWrap`): **vertical** (stacked), **horizontal** (a row), or
  **wrap** (horizontal rows that wrap). The user picks the mode from controls on the selected group's
  title bar.
- **Reflow engine.** A group owns the layout of its members: it overwrites each member's `Layout` to a
  uniform cell packed in `itemIds` order. One group dimension is **user-controlled** (width for
  vertical/wrap, height for horizontal) and the other is **auto-computed** from the member count/row
  count; the computed dimension is persisted into `group.layout`. Because reflow packs in `itemIds` order,
  **`itemIds` *is* the members' visual reading order** — no geometry is needed to read a group internally.
- **Membership.** `Group.itemIds` is the authoritative ordered list; each member task also stores
  `groupId`. A task entering a group saves its `preGroupLayout`; leaving restores it. Drop position
  during a drag determines the insertion index within `itemIds`. Entering, leaving, reordering, and
  moving between groups are distinct operations on the canvas data service, each persisting the group
  plus the affected items.
- **Hit-testing (pointer-events).** The group card root is `pointer-events: none` so it never swallows
  clicks meant for the cards layered above it; only its title bar and resize handles opt back in with
  `pointer-events: auto`. This decouples correct interaction from z-index ordering, which a
  bring-to-front can otherwise invert (D-IMPL-22).

### 8.9 Projection to parent (projected children)

A task that is a child of **another task** can opt to "project" a summary of itself onto its parent's
card. The parent card shows a **"Sub-task progress"** list of its opted-in direct children (1st level
only) — title + urgency — between the description and the status bar. This gives at-a-glance progress
without drilling in. (Top-level tasks, whose parent is the project, have no parent card to project onto
and so do not offer the toggle.)

- **Opt-in.** `Task.projectToParent` is toggled from the Details Pane checkbox **and** an inline button
  on the child card's status bar.
- **Ordering = layout (not urgency).** The list is ordered by `projectionOrder`, a reading-order rank
  derived from the **parent canvas layout** by a pure server-side function: top-level units (loose items
  and groups, each by its box) are banded into rows by vertical overlap, rows run top→bottom and members
  left→right, with urgency only as a positional tiebreaker. A **group expands in place** into its
  `itemIds` order at the rank its box earned — geometry runs only at the free top level, never inside a
  group. Computed on write, coalesced per parent (§6.4).
- **Completion display & toggle.** Completed children render struck-through, color-neutralized, and with
  a check icon; each row's leading icon is a **toggle** that flips the child's completion. The child task
  lives on the parent's own canvas (not loaded in the grandparent view), so the toggle persists the child
  directly and optimistically patches the parent's embedded `projectedChildren` copy for instant feedback.
- **Card layout under projection.** On a card, the description fills available space and the projected
  list is the element that shrinks when the card is short: the list scrolls (scrollbar hidden) and shows
  a bottom fade + chevron hint when it is clipping. The status bar stays pinned to the bottom (D-IMPL-28).

### 8.10 Moving items between workspaces (reparent)

A *workspace* is the set of items sharing one `parentTaskId` (or none — the project root). Items can be
moved between workspaces, changing which task owns them. **Position is preserved** (**P1**): the moved
item keeps its `Layout`, so it lands at the same coordinates in the destination. Two gestures exist
(D-IMPL-30):

- **Promote** (move out one level): a per-card right-click context menu promotes the selected items to
  the **parent's parent** (or to the project root when the current parent is itself a root task). Only
  offered inside a task workspace.
- **Make child** (drop onto a task): while dragging, every *other* task card reveals a **drop zone**;
  releasing over it makes the dragged item(s) children of that task. A confirmation (**P6**-style, though
  non-destructive) precedes the move.

Both operate on the **whole selection** (§8.7); a selected group carries its members, which are not moved
twice. Reparenting is a server operation (`ReparentService`, §12.2): it rewrites the moved item's
`parentTaskId`/`ancestorTaskIds`, **rewrites the materialized path of every descendant** (tasks, notes,
and dashboards carry `ancestorTaskIds`), carries a group's member tasks along, clears the moved task's
group membership, and schedules a projection recompute (§6.4) for both the old and new parents. Moving a
task into its own subtree is rejected.

### 8.11 Markdown bodies

A Task's `description` and a Note's `details` are **Markdown** — links, bold/italic, lists, headings.
They render to sanitized HTML on the card (and in the Details Pane preview), and links open in a new tab
(plain click in the read-only card view). Editing toggles between a **Markup** view (raw-markdown
textarea) and an editable **Preview** (a `contenteditable` surface). In Preview, selecting text and
pasting a linkable URL (http/https, or a bare domain/`www.` auto-prefixed to https) turns the selection
into a link; `Cmd`/`Ctrl`-click opens a link there (plain click is reserved for placing the caret).
Markdown is the source of truth: Preview edits are serialized back to Markdown; the round-trip preserves
content but may normalize formatting (D-IMPL-31).

### 8.12 Due dates & countdown

A Task may carry an optional `dueDate`. When set, the card's status bar shows a **live countdown**,
refreshed by a shared clock tick (one timer multicast to all cards):

- A future calendar date → a **day count** (`Nd`).
- Today's calendar date → **`HH:MM`** remaining (styled with extra urgency).
- **Overnight exception:** if the due time is before **05:00** *and* today is exactly the calendar day
  before the due date, show `HH:MM` instead of a day count — early-hours items read as imminent rather
  than "a day away".
- **Overdue** (now ≥ due) → bottoms out at `00:00`, no special styling.

The date/time is set from both a calendar control on the card (a popover date-time picker, keyboard- and
mouse-enterable) and a field in the Details Pane; either can clear it. The display logic is a pure,
tested function (D-IMPL-32).

---

## 9. Styling & Design Tokens (P8)

All colors and shared metrics live as CSS custom properties in `src/styles.scss`, extending the tokens
already scaffolded there. Add at minimum:

```scss
:root {
    // Urgency backgrounds
    --color-urgency-long-term-bg: #e4e3fb;
    --color-urgency-long-term-border: #7b73d4;
    --color-urgency-low-bg: #dff0db;
    --color-urgency-low-border: #6aa564;
    --color-urgency-normal-bg: #eceff2;
    --color-urgency-normal-border: #94a1ae;
    --color-urgency-important-bg: #ffe3c2;
    --color-urgency-important-border: #e0903c;
    --color-urgency-urgent-bg: #ffd0c2;
    --color-urgency-urgent-border: #dd5a36;
    --color-urgency-immediate-bg: #ffc4c4;
    --color-urgency-immediate-border: #d23838;

    // Note header
    --color-note-header-bg: #fdf2c4;
    --color-note-header-border: #d9c65e;

    // Card text
    --color-text-on-card: #2b2b2b;
}
```

Rules:
- Never hard-code these colors in components — reference the tokens.
- Every overlay (dialog, dropdown, confirmation) uses `appendTo="body"`.
- Reuse existing layout utilities (`layout.scss`) and Bootstrap/PrimeNG classes before adding new ones.

---

## 10. Routing & Navigation (P5)

The URL is the source of truth for "where am I." The route encodes the full ancestor chain so that
**stripping the right-most segment navigates to the parent canvas**, exactly as requested.

| Route                                            | Shows                                            |
| ------------------------------------------------ | ------------------------------------------------ |
| `/` → redirect to `/projects`                    | —                                                |
| `/projects`                                      | Project list (create + open)                     |
| `/projects/:projectId`                           | Project canvas                                   |
| `/projects/:projectId/tasks/<id1>/<id2>/…/<idN>` | Canvas of task `idN`, nested under `id1…id(N-1)` |

- The task chain is captured as the remaining path after `tasks/` (wildcard segment), parsed into an
  ordered id list. The **last** id is the current canvas; the preceding ids are its ancestors.
- The **breadcrumb** renders Project → each task in the chain; clicking a crumb navigates by truncating
  the chain to that point. A dedicated **"back to parent"** control does the same one-level strip.
- The chain parsed from the URL is validated against the loaded task's `ancestorTaskIds` (§5.5); a
  mismatch or missing id routes to a not-found / nearest-valid ancestor.
- Wildcard `**` redirects to `/projects`.

> Encoding the whole chain in the path (rather than just the current task id) is what makes "remove the
> right-most portion to go up" work for arbitrary depth. This is the recommended approach; see §13 if
> you'd prefer the simpler single-id route with breadcrumb rebuilt purely from `ancestorTaskIds`.

---

## 11. Architecture — Frontend (Angular)

Follow the scaffolded patterns (ComponentBase, `takeUntil(ngDestroy$)`, services own state, API clients
own HTTP). Decompose by single responsibility (**P7**); the canvas is **one** implementation reused at
every level (**P2**).

### 11.1 Interaction & viewport services

| Service                    | Responsibility                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `ViewportService`          | Holds live pan/zoom; converts screen ↔ canvas space; restores/persists `viewState`. One instance per active canvas. |
| `CanvasInteractionService` | Pointer handling for move/resize/pan/zoom gestures, including multi-item drag and group drag (the group plus its contained items); emits intent, delegates persistence to the canvas data service. Also broadcasts drag-active state + the dragged ids, tracks the hovered drop-target task, and emits a reparent-drop signal when a drag ends over a task's drop zone (§8.10). |
| `SelectionService`         | The current selection **set** (tasks, notes, groups; §8.7); drives multi-drag/multi-delete and the Details Pane. Global singleton (D-IMPL-03).                                       |

### 11.2 Data / state services

| Service              | Responsibility                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ProjectsService`    | List/create/update/delete projects; exposes `projectListing$` with a reload subject.                                                                                     |
| `CanvasDataService`  | For the current host, loads its tasks (via the *with-projections* endpoint, so each task carries its `projectedChildren`) + notes + groups; exposes them as observables; handles add/move/resize/complete/delete, all group operations (enter/exit/reorder/move-between, the reflow engine), projected-child completion, **due-date set/clear**, and **reparenting the selection** (delegating to the reparent endpoints, then reloading), by delegating to API clients. |
| `NavigationService`  | Parses the URL task chain, builds the breadcrumb, exposes navigation helpers (drill in, go to parent, jump to crumb).                                                    |
| `DeletionService`    | Wraps PrimeNG confirmation + the delete API call; the single entry point for all destructive actions (**P6**). Covers projects, tasks, notes, groups, and dashboards. Each method takes `(id, label, onSuccess)` — it shows the dialog, calls the API on accept, clears selection, then fires `onSuccess`. The caller's `onSuccess` removes the item from local state only (no second API call). Never call `window.confirm` or any other ad-hoc confirmation for a destructive action — always add a method here. |
| `DetailsPaneService` | Tracks the edit buffer + dirty state for the selected entity; Accept persists, Cancel reverts.                                                                           |

Two app-wide utility singletons (`providedIn: 'root'`) support the features above: **`MarkdownService`**
renders Markdown → sanitized HTML, serializes edited HTML back to Markdown, and decides what counts as a
linkable URL (§8.11); **`ClockService`** exposes one multicast "now" tick that drives every due-date
countdown (§8.12).

> **Frontend null policy.** Use `undefined`, not `null`, throughout the client domain (models, state,
> service signatures, `EventEmitter` payloads). `null` is allowed only at the HTTP boundary (a partial
> update must send an explicit value to clear a field, since JSON drops `undefined`) or when coercing a
> value a 3rd-party control hands back. See `project-management-client/CLAUDE.md`.

### 11.3 API clients

Under `src/app/services/api-clients/`, extending `ApiClientBase`:
- Split into focused clients: `ProjectApiClient`, `TaskApiClient`, `NoteApiClient`, `GroupApiClient`,
  `DashboardApiClient` (D-IMPL-11). `ClientApiService` is a thin re-export shim.
- `TaskApiClient` includes the *with-projections* canvas loads (`by-project/:id/with-projections`,
  `by-parent/:id/with-projections`) used to embed `projectedChildren` (§6.4).
- Each item client exposes a `reparent(id, newParentTaskId)` method hitting the `…/:id/reparent`
  endpoint (§8.10, §12.3).
- One method per endpoint, all returning `Observable`s, typed with shared-models.
- (Auth headers are scaffolded but unused — single-user app, no login.)

### 11.4 Components (indicative)

```
components/
├── component-base/
├── project-list/                 — project cards, create button
├── canvas-host/                  — THE reusable canvas (P2): hosts any project/task canvas,
│                                    owns the per-canvas services, renders items + the details pane
├── canvas/
│   ├── task-card/                — task card (urgency color/picker, completion toggle, drill-in,
│   │   │                            project-to-parent toggle, inline title editing, due-date picker
│   │   │                            + countdown, drop zone for make-child)
│   │   └── task-projected-children/ — the "Sub-task progress" list on a parent card (§8.9)
│   ├── note-card/                — note specialization (off-yellow header, body color)
│   ├── group-card/               — group container card (title bar, layout-mode controls, reflow)
│   └── canvas-context-menu/      — custom positioned right-click menu (D-IMPL-01); reused per-card for Promote (§8.10)
├── shared/
│   ├── markdown-view/            — read-only Markdown renderer for card bodies (§8.11)
│   └── markdown-editor/          — markup/preview Markdown editor with paste-to-link (§8.11)
└── details-pane/                 — selection-driven editor (project | task | note | dashboard)
```

---

## 12. Architecture — Backend (Node/Express)

Follow the scaffolded patterns (reflect-metadata first, Inversify composition root, route factories,
Zod validation, global error handler, `DbCollectionNames`).

### 12.1 DB services

`ProjectDbService`, `TaskDbService`, `NoteDbService`, `GroupDbService` — each `@injectable()`, extending
`DbService`, with CRUD plus the canvas-scoped and subtree queries from §6. Set `ancestorTaskIds` on insert.
`TaskDbService` additionally owns the *with-projections* aggregates (§6.4) and `setProjectionOrders`
(one bulk write that stamps the reading-order rank on many children).

### 12.2 Domain services

- `CascadeDeleteService` — owns the multi-step subtree deletion (§6.3) across collections.
- `ReparentService` — moves an item to a new parent task (or the project root): rewrites the item's
  `parentTaskId`/`ancestorTaskIds`, rewrites every descendant's materialized path in one
  aggregation-pipeline update per collection (tasks, notes, dashboards), carries a group's member tasks,
  and schedules a projection recompute for the old and new parents (§8.10). Rejects moving a task into its
  own subtree.
- `ProjectionOrderService` — recomputes children's `projectionOrder` from the parent canvas layout
  (§8.9). It is triggered on write by the task/group routers and **coalesces** a transition's writes per
  parent task via a trailing timer, so the graph/tree ordering work runs at most once per layout
  transition and the read path stays a plain `$sort` (§6.4). The pure ordering algorithm lives in a
  separate, testable util (`projection-order.util.ts`); the service only loads, diffs, and persists.
- Future grouping/organization features get their own services rather than bloating existing ones (**P7**).

### 12.3 Routes

Route factories per concern: `createProjectRouter`, `createTaskRouter`, `createNoteRouter`,
`createGroupRouter`, `createDashboardRouter`. Validate incoming bodies with Zod (create/update payloads).
Handlers `try/catch`, return early, defer unexpected errors to the global handler. No auth middleware on
routes (single-user). Each item router exposes `PUT /:id/reparent` (body `{ newParentTaskId: string | null }`,
`null` = project root), delegating to `ReparentService` (§8.10, §12.2).
The task and group routers call `ProjectionOrderService.scheduleRecompute(parentTaskId)` after writes that
can change reading order (task layout/grouping/urgency, group layout/membership/direction, and
create/delete) — never on view-state-only updates (§6.4, §8.9).

---

## 13. Resolved Decisions

All forks below are **confirmed** (2026-06-07) and are now binding requirements. The rationale is kept
so the reasoning survives.

| #   | Decision                                  | Resolution                                                                                                                                       | Rationale                                                                                                                                                                                                                                                                                                                                                            |
| --- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Canvas rendering technology**           | ✅ **DOM cards in a CSS-transformed container** (absolutely-positioned elements; pan/zoom via one transform). Not a raw `<canvas>` element.       | A literal `<canvas>` means hand-rolling text layout, truncation, hit-testing, resize handles, and editing — and gives up PrimeNG/HTML for the cards. A DOM-transform "canvas" delivers the same pan/zoom/drag/resize feel while letting cards be real, styled, editable HTML.                                                                                          |
| D2  | **Route encoding for deep nesting**       | ✅ Encode the **full task-id chain** in the path (§10) so right-trimming the URL goes up a level.                                                 | The simpler single-id alternative doesn't satisfy "remove the right-most portion to navigate to the parent."                                                                                                                                                                                                                                                         |
| D3  | **Materialized path (`ancestorTaskIds`)** | ✅ Adopt it on tasks and notes.                                                                                                                   | Makes subtree loads and cascade deletes cheap and non-recursive; small write-time cost; strongly supports the "expand later" mandate (**P7**).                                                                                                                                                                                                                       |
| D4  | **Persist pan/zoom per canvas**           | ✅ Store `viewState` on each host.                                                                                                                | Directly serves the spatial-memory purpose (**P0/P1**).                                                                                                                                                                                                                                                                                                              |
| D5  | **Completion cascade**                    | ✅ **No cascade.** Completing a task never changes its children; each item's `isComplete` is owned solely by that item.                            | The user must implicitly understand exactly what an action does — completing a parent must not silently alter children. It also makes completion **losslessly reversible**: un-completing a task later returns the subtree to the identical state it had before, because nothing else was ever touched. (This is independent of deletion, which *does* cascade — §6.3.) |
| D6  | **Where notes/tasks are edited**          | ✅ The Details Pane remains the complete, uniform editor (**P2**). ⚠️ **Updated:** inline editing has *since been added* on cards as a convenience — title, description, urgency picker, completion toggle, and project-to-parent toggle (D-IMPL-23). | Started Details-Pane-only to keep one editing model; inline controls were layered on later for fast in-place edits without abandoning the pane as the full editor. |
| D7  | **Urgency semantics**                     | ✅ Urgency is **entirely visual** — it sets card color and nothing else. No aggregation, no roll-up, no mechanical behavior.                       | There is no other mechanical part to urgency; deriving a parent's urgency from children would invent behavior the model doesn't have.                                                                                                                                                                                                                                |

---

## 14. Open / Deferred (not yet specified)

**Now implemented** (were deferred in the original design):

- **Multi-select & multi-drag** (§8.7).
- **Grouping** — Group items with vertical/horizontal/wrap reflow (§8.8); the first "grouping strategy."
- **Projection to parent** — projected children with layout-derived reading order (§8.9, §6.4).
- **Inline editing** on cards (D6 update) and **inline completion toggles**.
- **Reparenting** — promote to the parent's parent + drop-onto-task to make a child, position-preserving (§8.10).
- **Markdown bodies** — Task descriptions and Note details, with a markup/preview editor and paste-to-link (§8.11).
- **Due dates** — optional per-task `dueDate` with a live card countdown (§8.12).

Still open / not yet specified:

- Search / filtering across a project's tasks and notes.
- Connectors or visual relationships between items beyond containment.
- Export / import / backup of a project.
- Fuller keyboard shortcuts (today: `Delete` removes the selection; `Shift`/`Ctrl` modify multi-select).
- Additional grouping strategies beyond the Group container (**P7** anticipates more).

> Note: the **Dashboard** and **DataDefinition** entities (metric widgets) also exist in the codebase and
> MCP surface but are not yet written into §5–§6 of this spec. They carry the same canvas-scoping and
> (for dashboards) `ancestorTaskIds` as other items. Documenting them here is outstanding.

---

## 15. References

- [`application-details.md`](./application-details.md) — original vision (source for this document).
- [`CLAUDE.md`](./CLAUDE.md) — workspace overview, ports, architecture summary.
- `project-management-client/CLAUDE.md` — frontend conventions.
- `project-management-server/CLAUDE.md` — backend conventions.
- `mean-stack-project-setup/references/project-standards.md` — cross-cutting coding standards.
