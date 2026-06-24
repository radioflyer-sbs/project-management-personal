# project-management-mcp — MCP Server

## Purpose
Exposes the Project Management application's REST API as MCP tools so Claude can read and write projects, tasks, notes, groups, data definitions, and dashboards.

## Stack
- **Node.js** with TypeScript (ESM, `"type": "module"`)
- **@modelcontextprotocol/sdk** — MCP server and stdio transport
- **Zod** — input validation on tool parameters

## Running
```
npm run build     # compile TypeScript → dist/
npm start         # run compiled server (stdio transport)
```

## API base URL
Defaults to `http://localhost:1089/api`. Override with `PM_API_URL` env variable.

## MCP registration (Claude Desktop / Claude Code)
In your MCP config, point to the compiled entry point:
```json
{
  "mcpServers": {
    "project-management": {
      "command": "node",
      "args": ["e:/development/project-management/project-management-mcp/dist/index.js"]
    }
  }
}
```

## Tool surface
| Category | Tools |
|----------|-------|
| Projects | `list_projects`, `get_project`, `create_project`, `update_project` |
| Tasks | `list_tasks`, `get_task`, `create_task`, `update_task` |
| Notes | `list_notes`, `create_note`, `update_note` |
| Groups | `list_groups`, `create_group`, `update_group`, `manage_task_group` |
| Data Definitions | `list_data_definitions`, `get_data_definition`, `create_data_definition`, `update_data_definition`, `set_data_value` |
| Dashboards | `list_dashboards`, `get_dashboard`, `create_dashboard`, `update_dashboard`, `manage_widget` |
| Canvas | `get_current_view`, `get_canvas_layout`, `set_canvas_layouts` |
| Mutations | `delete_item`, `move_item`, `reparent_item`, `set_metrics` |
| API Docs | `get_api_info`, `get_api_endpoints` |

### Consolidated mutation tools
`delete_item(type, id)` — deletes any item type (`task`, `note`, `group`, `dashboard`, `project`, `data-definition`).
`move_item(type, id, x, y, width?, height?)` — moves/resizes any card; groups auto-reflow member tasks.
`reparent_item(type, id, newParentTaskId)` — moves any card to another workspace by changing its owning parent task (`null` = project root); the card keeps its layout. Tasks carry their subtree; groups carry their members. Use for "promote" (parent's parent) and "make child" (drop onto a task).
`set_metrics(projectId, metrics[])` — bulk metric value push; collapses N socket broadcasts into one call.
`set_canvas_layouts([...])` — batch position/size update for any mix of card types.

### API documentation tools
`get_api_info` — returns server base URL, port, auth status, Socket.IO event name, Content-Type requirements, and the list of available endpoint categories.
`get_api_endpoints(category)` — returns the full endpoint reference for one category (method, path, body schema, response, caveats). Categories: `projects`, `tasks`, `notes`, `groups`, `data-definitions`, `dashboards`, `app-state`.

These tools are the source of truth for scripted direct HTTP access. **When REST endpoints are added, removed, or changed, `src/tools/api-docs.ts` must be updated in the same session.**

## System context resource
The server exposes `pm://context` — a Markdown document Claude can read to understand the app's data model and how addressing works. Load it at the start of a session to orient Claude.

## Key patterns
- Every tool wraps one REST call; exceptions are `add_widget` and `remove_widget`, which do a GET + PUT in the MCP layer as a convenience.
- `set_data_value` is the hot path — it updates a metric's value and the server broadcasts it over Socket.IO to all referencing widgets.
- Dashboard addressing: `(projectId, key)` for lookup; `_id` for mutations. `get_dashboard_by_id` accepts just the `_id`.
- Data definition addressing: `(projectId, id)` for value writes; `_id` for metadata updates.
- Widget type must match the data definition's valueType — see `pm://context` for the compatibility table.

## Keeping the MCP server current

**The MCP server must be kept in sync with the application as it evolves.**

Whenever a session introduces new concepts, data model changes, UI behaviour changes, or new workflows to the client or server, update the MCP server in the same session:

1. **`src/tools/*.ts`** — Add, remove, or update tool descriptions and Zod schemas to reflect new fields, new endpoints, changed semantics, or deprecated flags.
2. **`src/tools/api-docs.ts`** — Update the `ENDPOINTS` catalogue whenever a REST endpoint is added, removed, or its schema changes. This is the direct-HTTP reference for scripted access.
3. **`src/index.ts` (context resource)** — Update the `pm://context` Markdown document so Claude has an accurate mental model. Key sections to keep current:
   - Item type descriptions and their fields
   - Widget type ↔ data definition type compatibility table
   - Editing and UI behaviour (e.g. where editors appear)
   - Workflow examples
4. **`CLAUDE.md` (this file)** — Update the tool surface table when tools are added or removed.

Rebuild after every change:
```
npm run build
```
