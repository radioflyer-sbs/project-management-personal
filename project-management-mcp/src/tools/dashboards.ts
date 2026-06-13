import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api } from '../api-client.js';

const WidgetSchema = z.object({
    id:       z.string().describe('Unique within the dashboard — immutable after creation'),
    dataId:   z.string().describe('References a DataDefinition.id in the same project'),
    type:     z.enum(['number', 'progress', 'status', 'text', 'list', 'toggle', 'gauge']),
    label:    z.string().optional(),
    icon:     z.string().optional().describe('PrimeIcons name, e.g. "pi-check-circle"'),
    editable: z.boolean().describe('If true, user edits write through to the referenced metric'),
    options:  z.object({
        format:          z.string().optional(),
        colorThresholds: z.array(z.object({ value: z.number(), color: z.string() })).optional(),
        suffix:          z.string().optional(),
        prefix:          z.string().optional(),
    }).optional(),
});

export function registerDashboardTools(server: McpServer): void {

    server.tool(
        'list_dashboards',
        'Enumerate all dashboards on a project canvas or task canvas. Returns each dashboard\'s key, title, and widget summary.',
        {
            projectId:    z.string().optional(),
            parentTaskId: z.string().optional(),
        },
        async ({ projectId, parentTaskId }) => {
            let dashboards: unknown;
            if (parentTaskId) {
                dashboards = await api.get(`/dashboards/by-parent/${parentTaskId}`);
            } else if (projectId) {
                dashboards = await api.get(`/dashboards/by-project/${projectId}`);
            } else {
                return { content: [{ type: 'text', text: 'Provide projectId or parentTaskId.' }] };
            }
            return { content: [{ type: 'text', text: JSON.stringify(dashboards, null, 2) }] };
        }
    );

    server.tool(
        'get_dashboard',
        'Get a dashboard by its project-scoped key. Returns full config including widgets and the metrics they reference.',
        {
            projectId: z.string(),
            key:       z.string().describe('Unique per-project dashboard key (e.g. "build-overview")'),
        },
        async ({ projectId, key }) => {
            const dashboard = await api.get(`/dashboards/by-project/${projectId}/key/${key}`);
            return { content: [{ type: 'text', text: JSON.stringify(dashboard, null, 2) }] };
        }
    );

    server.tool(
        'create_dashboard',
        'Create a new dashboard on a canvas. The key must be unique per project (409 if taken). Widget dataIds must resolve to existing data definitions (422 if not). Duplicate widget ids within the dashboard are rejected (409).',
        {
            projectId:       z.string(),
            parentTaskId:    z.string().optional().describe('Parent task _id for sub-canvas placement; omit for project canvas'),
            ancestorTaskIds: z.array(z.string()).optional(),
            title:           z.string(),
            key:             z.string().describe('Unique per-project string key — the stable address for API/MCP'),
            widgets:         z.array(WidgetSchema).optional().default([]),
            x:               z.number().optional().default(200),
            y:               z.number().optional().default(200),
            width:           z.number().optional().default(420),
            height:          z.number().optional().default(360),
        },
        async ({ projectId, parentTaskId, ancestorTaskIds, title, key, widgets, x, y, width, height }) => {
            const dashboard = await api.post('/dashboards', {
                projectId,
                parentTaskId,
                ancestorTaskIds: ancestorTaskIds ?? [],
                title,
                key,
                config: { widgets },
                layout: { x, y, width, height, zIndex: Date.now() },
            });
            return { content: [{ type: 'text', text: JSON.stringify(dashboard, null, 2) }] };
        }
    );

    server.tool(
        'update_dashboard_config',
        'Replace the widget list of a dashboard (full declarative update). Duplicate widget ids → 409; unknown dataIds → 422; no partial writes.',
        {
            dashboardId: z.string().describe('MongoDB _id of the dashboard'),
            widgets:     z.array(WidgetSchema),
        },
        async ({ dashboardId, widgets }) => {
            const dashboard = await api.put(`/dashboards/${dashboardId}`, { config: { widgets } });
            return { content: [{ type: 'text', text: JSON.stringify(dashboard, null, 2) }] };
        }
    );

    server.tool(
        'update_dashboard_title',
        'Update a dashboard\'s display title.',
        {
            dashboardId: z.string(),
            title:       z.string(),
        },
        async ({ dashboardId, title }) => {
            const dashboard = await api.put(`/dashboards/${dashboardId}`, { title });
            return { content: [{ type: 'text', text: JSON.stringify(dashboard, null, 2) }] };
        }
    );

    server.tool(
        'delete_dashboard',
        'Delete a dashboard. Data definitions it referenced are not affected.',
        { dashboardId: z.string() },
        async ({ dashboardId }) => {
            await api.delete(`/dashboards/${dashboardId}`);
            return { content: [{ type: 'text', text: `Dashboard ${dashboardId} deleted.` }] };
        }
    );
}
