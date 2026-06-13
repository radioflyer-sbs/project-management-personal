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
A single-user project management tool. There is no authentication — all data is shared and belongs to one user.

## Core concepts

### Projects
Top-level containers. Each project has its own canvas (a freeform 2D space) where tasks, notes, groups, and dashboards are placed.

### Tasks
The primary work items. Tasks can be nested: clicking into a task opens its own sub-canvas, which can contain more tasks, notes, groups, and dashboards. Each task has:
- **title** and **description**
- **urgency**: low | normal | high | critical
- **isComplete**: completion toggle
- **projectToParent**: when true, the task appears in its parent task's "projected children" list
- **layout**: x/y/width/height/zIndex on its canvas

### Notes
Sticky-note items on a canvas. Have title, details, and backgroundColor.

### Groups
Visual container items that reflow their member tasks (vertical, horizontal, or wrap). Groups hold \`itemIds\` — an ordered list of task _ids.

### Dashboards
Presentation-layer cards that display metrics. A dashboard has a unique **key** per project and a **config** containing an ordered list of **widgets**. Dashboards do NOT store data — they reference **data definitions**.

### Data Definitions
Project-scoped metrics. Each has a unique string **id** (the stable address for reads/writes), a **valueType** (number | text | boolean | enum | timestamp | list), and a **value** that lives inside the definition. Multiple widgets on multiple dashboards can reference the same data definition — updating the value once updates every display.

## How addressing works
- A project is identified by its MongoDB \`_id\`
- A task / note / group / dashboard is identified by its MongoDB \`_id\`
- A data definition is addressed as \`(projectId, id)\` — where \`id\` is the user-assigned string (e.g. "build-status")
- A dashboard is addressed as \`(projectId, key)\` — where \`key\` is the user-assigned string (e.g. "build-overview")

## Workflow for setting up a dashboard
1. Call \`list_projects\` to discover project ids.
2. Call \`create_data_definition\` for each metric you want to display.
3. Call \`create_dashboard\` with a list of widgets, each referencing a data definition by \`dataId\`.
4. Call \`set_data_value\` to push live updates to any metric at any time.

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
