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
Defaults to `http://localhost:1073/api`. Override with `PM_API_URL` env variable.

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
| Projects | `list_projects`, `get_project`, `create_project`, `update_project`, `delete_project` |
| Tasks | `list_tasks`, `get_task`, `create_task`, `update_task`, `delete_task` |
| Notes | `list_notes`, `create_note`, `update_note`, `delete_note` |
| Groups | `list_groups`, `create_group`, `update_group`, `delete_group` |
| Data Definitions | `list_data_definitions`, `get_data_definition`, `create_data_definition`, `update_data_definition`, `set_data_value`, `delete_data_definition` |
| Dashboards | `list_dashboards`, `get_dashboard`, `create_dashboard`, `update_dashboard_config`, `update_dashboard_title`, `delete_dashboard` |

## System context resource
The server exposes `pm://context` — a Markdown document Claude can read to understand the app's data model and how addressing works. Load it at the start of a session to orient Claude.

## Key patterns
- Every tool wraps one REST call; no logic lives in the MCP layer.
- `set_data_value` is the hot path — it updates a metric's value and the server broadcasts it over Socket.IO to all referencing widgets.
- Dashboard addressing: `(projectId, key)` for lookup; `_id` for mutations.
- Data definition addressing: `(projectId, id)` for value writes; `_id` for metadata updates.
