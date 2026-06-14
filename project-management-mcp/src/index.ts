import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerProjectTools } from './tools/projects.js';
import { registerTaskTools } from './tools/tasks.js';
import { registerNoteTools } from './tools/notes.js';
import { registerGroupTools } from './tools/groups.js';
import { registerDataDefinitionTools } from './tools/data-definitions.js';
import { registerDashboardTools } from './tools/dashboards.js';

const server = new McpServer({
    name: 'project-management',
    version: '1.0.0',
});

// ── System context resource ───────────────────────────────────────────────────
server.resource(
    'app-context',
    'pm://context',
    async () => ({
        contents: [{
            uri: 'pm://context',
            mimeType: 'text/markdown',
            text: `# Project Management Application — MCP Context

## What this application is
A single-user spatial task manager. There is no authentication — all data belongs to one user.
The core metaphor is a **freeform 2D canvas**: items are cards you drag, resize, and arrange freely.
Position and grouping carry meaning; the app never auto-rearranges anything.

---

## The canvas model (fractal / recursive)

Every **Project** and every **Task** owns its own canvas — a pannable, zoomable 2-D surface.
The canvas model is identical at every depth (same components, same interactions):

\`\`\`
Project  (root canvas)
 ├── Task        (card on the project canvas; also opens its own canvas)
 │    ├── Task   (card on that task's canvas; also opens its own canvas)
 │    │    └── … recursively, to any depth
 │    └── Note   (card on that task's canvas; leaf — has no canvas of its own)
 ├── Note        (leaf)
 ├── Group       (reflow container on the project canvas — NOT a canvas host)
 └── Dashboard   (metric display card on the canvas)
\`\`\`

Double-clicking a Task **drills in** to its canvas. A breadcrumb trail tracks the current depth.
Each canvas saves its own pan/zoom (\`viewState\`) so it reopens exactly where the user left it.

---

## Item types and their roles

### Task
The primary work item. It is **both** a card on its parent canvas **and** a canvas host for children.

Fields:
- \`title\`, \`description\`
- \`urgency\` — drives card color (see palette below); one of:
  \`long-term-goal | low | normal | important | urgent | immediate\`
- \`isComplete\` — completion toggle (purely per-task; completion never cascades to children)
- \`layout\` — \`{ x, y, width, height, zIndex }\` position/size on its parent canvas
- \`viewState\` — saved pan/zoom of this task's own (child) canvas
- \`parentTaskId\` — omit to place the task directly on the project canvas
- \`ancestorTaskIds\` — ordered chain of all ancestor task ids (root-first); used for subtree queries
- \`groupId\` — set when this task is a member of a Group on its canvas
- \`projectToParent\` — see "Projection to parent" below
- \`projectedChildren\` — see "Projection to parent" below (derived, not stored on Task)

### Note
A sticky-note leaf. Lives on a canvas, cannot contain children.

Fields: \`title\`, \`details\`, \`backgroundColor\` (CSS color for the body; header is always off-yellow), \`layout\`.

### Group
A labeled reflow container on a canvas. Groups are **not canvas hosts** — their members remain items
on the **same** canvas, just repositioned by the group's reflow engine.

A group arranges its member tasks in a chosen direction (\`vertical | horizontal\`, optionally \`wrap\`).
Membership is the ordered list \`itemIds\`; each member task also carries \`groupId\` back-referencing it.
Removing a task from a group restores its pre-group layout (\`preGroupLayout\`).

### Dashboard
A metric display card that lives on a canvas alongside tasks and notes.
It has a position (\`layout\`), a human title, a project-unique string \`key\`, and a \`config.widgets\` list.
**Dashboards store no data** — they only reference data definitions by \`dataId\`.

#### Widget types and required data definition valueTypes

Each widget type is designed for one compatible data definition valueType.
Using mismatched types will not error but will produce incorrect display.

| Widget type | Compatible def valueType | Display |
|-------------|--------------------------|---------|
| \`number\`    | \`number\`                 | Large bold numeric value with optional prefix/suffix/unit |
| \`progress\`  | \`number\`                 | Horizontal fill bar — requires \`def.options.min\` and \`def.options.max\` |
| \`gauge\`     | \`number\`                 | Arc (semicircle) gauge — requires \`def.options.min\` and \`def.options.max\` |
| \`status\`    | \`enum\`                   | Blue pill badge showing the current enum option — requires \`def.options.enumOptions\` (a fixed list of allowed string values). Use when the value is one of a named set (e.g. "open / in-progress / done"). |
| \`text\`      | \`text\` or \`timestamp\`    | Plain unstyled string — no pill, no badge, just the raw value displayed inline. Use for free-form strings or timestamps. |
| \`toggle\`    | \`boolean\`                | Green "On" badge or gray "Off" badge. Strictly binary; use only for true/false values. |
| \`list\`      | \`list\`                   | Bulleted list of strings |

**Choosing between status, toggle, and text:**
- Use \`toggle\` when the value is a true boolean (on/off, enabled/disabled, pass/fail).
- Use \`status\` when the value is one named option chosen from a fixed set (state machine values, lifecycle phases, categories). Define the allowed options in \`def.options.enumOptions\`.
- Use \`text\` when the value is a free-form string with no fixed options, or when displaying a timestamp.

The app auto-suggests the correct widget type when a data definition is selected in the editor.

#### Widget options

Widget-level display options (\`widget.options\`): \`prefix\`, \`suffix\`, \`colorThresholds\`, \`format\`.
The unit label (for number widgets) lives on the **data definition** (\`def.options.unit\`), not the widget.

#### Editing

Widget values are edited in the **property panel** (sidebar) when the user clicks the dashboard card on the canvas.
The property panel shows an appropriate editor for each widget based on the data definition's valueType:
number → numeric input; enum → dropdown; boolean → checkbox; text → text input; list → add/remove list.

The \`editable\` flag on a widget has no effect in the current UI — it is retained for forward compatibility.
Set it to \`false\` when creating widgets unless you have a specific future use for it.

### Data Definition
A project-scoped named metric. This is where values actually live.

Fields: \`id\` (user-assigned stable string, e.g. "build-status"), \`label\`, \`valueType\`, \`value\`, \`options\`.
Value types: \`number | text | boolean | enum | timestamp | list\`.

**Scoping:** Data definitions are strictly project-scoped — they belong to the project, not to any
particular task canvas. A single data definition is visible and usable from every dashboard on every
canvas depth within that project (project canvas and all task canvases). There is no per-task-canvas
or per-subtree scoping.

**Cross-project references are not possible.** A dashboard and all the data definitions it
references must share the same \`projectId\`. The server will reject any widget whose \`dataId\` does
not resolve to a definition in the dashboard's own project.

Multiple widgets on multiple dashboards can reference the same data definition.
Calling \`set_data_value\` updates the stored value **and** broadcasts it over Socket.IO so every
dashboard widget displaying that metric refreshes live in the browser without a page reload.

---

## Urgency color palette

Card background and border color are driven entirely by \`urgency\`. Urgency is a visual property only —
it does not affect ordering, filtering, or any computed field.

| Urgency value      | Background | Border     | Visual meaning               |
| ------------------ | ---------- | ---------- | ---------------------------- |
| \`long-term-goal\`   | \`#e4e3fb\`  | \`#7b73d4\`  | Indigo/lavender — aspirational, no time pressure |
| \`low\`              | \`#dff0db\`  | \`#6aa564\`  | Green                        |
| \`normal\`           | \`#eceff2\`  | \`#94a1ae\`  | Neutral slate                |
| \`important\`        | \`#ffe3c2\`  | \`#e0903c\`  | Amber                        |
| \`urgent\`           | \`#ffd0c2\`  | \`#dd5a36\`  | Orange-red                   |
| \`immediate\`        | \`#ffc4c4\`  | \`#d23838\`  | Red — highest time pressure  |

Note headers are always off-yellow (\`#fdf2c4\` / \`#d9c65e\`), regardless of the task urgency around them.

---

## Projection to parent

A parent task's card can show a preview list of its direct children — without the user drilling in.
This is controlled per child via \`projectToParent\`.

- **\`projectToParent: true\`** on a child task → that child surfaces in its parent's \`projectedChildren\` list.
- **\`projectToParent: false\` (default)** → the child is invisible on the parent card face.
- **\`projectedChildren\`** is a **derived, read-only** field populated by the server when you call
  \`list_tasks\` (which uses the \`…/with-projections\` endpoint). It is **not stored** on the task
  document — do not try to write it. Each entry contains: \`{ _id, title, urgency, isComplete }\`.
- Children are ordered by \`projectionOrder\`, a server-computed rank derived from their 2-D positions on
  the parent canvas (top-left reads first). The user can toggle \`projectToParent\` on any child; the
  order reflects spatial layout, not insertion order.

---

## How addressing works

| Entity           | Primary address                                      |
| ---------------- | ---------------------------------------------------- |
| Project          | MongoDB \`_id\`                                        |
| Task / Note / Group / Dashboard | MongoDB \`_id\`                         |
| Data definition  | \`(projectId, id)\` — user-assigned string             |
| Dashboard lookup | \`(projectId, key)\` — user-assigned string            |

---

## Workflow: explore what's in a project

1. \`list_projects\` — find the project's \`_id\`.
2. \`list_tasks({ projectId })\` — top-level tasks on the project canvas (includes \`projectedChildren\`).
3. \`list_tasks({ parentTaskId })\` — recurse into a task's canvas.
4. \`list_notes\`, \`list_groups\`, \`list_dashboards\` — other items on the same canvas.

## Workflow: set up a dashboard

1. \`list_projects\` — get project \`_id\`.
2. \`create_data_definition\` for each metric. Choose \`valueType\` first — it determines which widget type to use.
3. \`create_dashboard\` with \`widgets\` pairing each metric \`id\` via \`dataId\` with the correct widget \`type\`:
   - \`number\` def → \`number\`, \`progress\`, or \`gauge\` widget (progress/gauge need \`def.options.min\` + \`max\`)
   - \`enum\` def → \`status\` widget (needs \`def.options.enumOptions: []\`)
   - \`text\`/\`timestamp\` def → \`text\` widget
   - \`boolean\` def → \`toggle\` widget
   - \`list\` def → \`list\` widget
4. Use \`add_widget\` / \`remove_widget\` to adjust individual widgets after creation without replacing the whole config.
5. \`set_data_value\` at any time to push a live update to a metric (broadcasts instantly over Socket.IO).

## Workflow: find a dashboard and inspect its metrics

1. \`list_dashboards({ projectId })\` — get all dashboards; note the \`_id\` and \`key\` of the one you want.
2. \`get_dashboard_by_id({ dashboardId })\` — fetch full config including all widget definitions.
3. \`list_data_definitions({ projectId })\` — see current values and options for all metrics.
4. \`get_data_definition({ projectId, id })\` — inspect a specific metric's value, type, and options.

---

## API base
\`http://localhost:1073/api\` — override with \`PM_API_URL\` env variable.
`,
        }],
    })
);

// ── Register all tools ────────────────────────────────────────────────────────
registerProjectTools(server);
registerTaskTools(server);
registerNoteTools(server);
registerGroupTools(server);
registerDataDefinitionTools(server);
registerDashboardTools(server);

// ── Start ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Project Management MCP server running on stdio');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
