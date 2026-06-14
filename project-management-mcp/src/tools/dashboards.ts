import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api } from '../api-client.js';

/**
 * Widget type ↔ data definition valueType compatibility:
 *
 *   number   → number def   — large numeric display; uses def.options.unit, widget.options.prefix/suffix
 *   progress → number def   — horizontal fill bar; requires def.options.min and def.options.max
 *   gauge    → number def   — arc gauge;            requires def.options.min and def.options.max
 *   status   → enum def     — pill badge showing current value; requires def.options.enumOptions
 *   text     → text def     — plain text display
 *   toggle   → boolean def  — On/Off badge
 *   list     → list def     — bulleted list of strings
 *
 * Mismatches (e.g. a 'status' widget pointing to a 'number' def) will not error server-side
 * but will produce unexpected display results in the browser.
 *
 * Note on 'editable':
 *   The 'editable' flag was originally used to show inline editors directly on the dashboard card.
 *   The UI has been updated so that ALL editing now happens in the sidebar property panel when the
 *   dashboard is selected — the flag no longer affects widget rendering. It is kept in the schema
 *   for forward compatibility but has no effect in the current UI. Set it to false unless you have
 *   a specific future use in mind.
 */
const WidgetSchema = z.object({
    id:     z.string().describe('Unique within the dashboard — immutable after creation; used to identify the widget for add/remove operations'),
    dataId: z.string().describe(
        'References a DataDefinition.id (not MongoDB _id) in the same project. ' +
        'Widget types require matching def valueTypes: number/progress/gauge → number def; ' +
        'status → enum def; text → text def; toggle → boolean def; list → list def.'
    ),
    type: z.enum(['number', 'progress', 'status', 'text', 'list', 'toggle', 'gauge']).describe(
        'number: large numeric value with optional prefix/suffix/unit. ' +
        'progress: horizontal fill bar (needs def.options.min + max). ' +
        'gauge: arc gauge (needs def.options.min + max). ' +
        'status: pill badge cycling through enum values (needs def.options.enumOptions). ' +
        'text: plain text display. ' +
        'toggle: On/Off badge for boolean values. ' +
        'list: bulleted list of strings.'
    ),
    label:    z.string().optional().describe('Display label shown above the value; defaults to the widget id if omitted'),
    icon:     z.string().optional().describe('PrimeIcons icon name including the "pi-" prefix, e.g. "pi-check-circle". The template renders it as class="pi pi-check-circle" — store the second part only.'),
    editable: z.boolean().describe(
        'Legacy flag — no longer has an effect. Editing now happens in the sidebar property panel when the dashboard is selected. Set to false.'
    ),
    options: z.object({
        format:          z.string().optional(),
        colorThresholds: z.array(z.object({ value: z.number(), color: z.string() })).optional(),
        suffix:          z.string().optional().describe('Appended after the value (for number widgets); e.g. "%"'),
        prefix:          z.string().optional().describe('Prepended before the value (for number widgets); e.g. "$"'),
    }).optional().describe('Widget-level display options. Unit (for number) lives on the data definition, not here.'),
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
        'Get a dashboard by its project-scoped string key. Returns full config including widgets, data def references, and layout.',
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
        'get_dashboard_by_id',
        'Get a dashboard by its MongoDB _id. Use this when you already have the _id from list_dashboards and do not have the key.',
        {
            dashboardId: z.string().describe('MongoDB _id of the dashboard'),
        },
        async ({ dashboardId }) => {
            const dashboard = await api.get(`/dashboards/${dashboardId}`);
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
            key:             z.string().describe('Unique per-project string key — the stable address for API/MCP lookups'),
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
        'Replace the entire widget list of a dashboard (full declarative update). Duplicate widget ids → 409; unknown dataIds → 422; no partial writes. Prefer add_widget / remove_widget for single-widget changes.',
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
        'add_widget',
        'Add a single widget to an existing dashboard without touching the other widgets. ' +
        'Fails with 409 if a widget with the same id already exists, or if the widget id conflicts with an existing one. ' +
        'The dataId must reference an existing data definition id (not MongoDB _id). ' +
        'Pick the widget type that matches the data definition\'s valueType: ' +
        'number/progress/gauge for number defs; status for enum defs; text for text/timestamp defs; toggle for boolean defs; list for list defs.',
        {
            dashboardId: z.string().describe('MongoDB _id of the dashboard'),
            widget:      WidgetSchema,
        },
        async ({ dashboardId, widget }) => {
            const dashboard = await api.get(`/dashboards/${dashboardId}`) as { config: { widgets: unknown[] } };
            const existing = dashboard.config.widgets as Array<{ id: string }>;
            if (existing.some(w => w.id === widget.id)) {
                return { content: [{ type: 'text', text: `Widget id "${widget.id}" already exists on this dashboard.` }] };
            }
            const updated = await api.put(`/dashboards/${dashboardId}`, {
                config: { widgets: [...existing, widget] },
            });
            return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] };
        }
    );

    server.tool(
        'remove_widget',
        'Remove a single widget from a dashboard by its widget id. All other widgets are preserved.',
        {
            dashboardId: z.string().describe('MongoDB _id of the dashboard'),
            widgetId:    z.string().describe('The widget\'s id field (not a MongoDB _id — this is the user-assigned string within the dashboard)'),
        },
        async ({ dashboardId, widgetId }) => {
            const dashboard = await api.get(`/dashboards/${dashboardId}`) as { config: { widgets: unknown[] } };
            const existing = dashboard.config.widgets as Array<{ id: string }>;
            const filtered = existing.filter(w => w.id !== widgetId);
            if (filtered.length === existing.length) {
                return { content: [{ type: 'text', text: `Widget id "${widgetId}" not found on this dashboard.` }] };
            }
            const updated = await api.put(`/dashboards/${dashboardId}`, {
                config: { widgets: filtered },
            });
            return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] };
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
        'move_dashboard',
        'Move and/or resize a dashboard card. x and y are required; width and height are optional and preserve the current value if omitted.',
        {
            dashboardId: z.string(),
            x:           z.number().describe('New canvas x position in pixels'),
            y:           z.number().describe('New canvas y position in pixels'),
            width:       z.number().optional().describe('New card width in pixels (default 420)'),
            height:      z.number().optional().describe('New card height in pixels (default 360)'),
        },
        async ({ dashboardId, x, y, width, height }) => {
            const dashboard = await api.get(`/dashboards/${dashboardId}`) as any;
            const layout = {
                ...dashboard.layout,
                x, y,
                ...(width  !== undefined ? { width  } : {}),
                ...(height !== undefined ? { height } : {}),
            };
            const updated = await api.put(`/dashboards/${dashboardId}`, { layout });
            return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] };
        }
    );

    server.tool(
        'delete_dashboard',
        'Delete a dashboard and its canvas placement. Data definitions it referenced are not affected.',
        { dashboardId: z.string() },
        async ({ dashboardId }) => {
            await api.delete(`/dashboards/${dashboardId}`);
            return { content: [{ type: 'text', text: `Dashboard ${dashboardId} deleted.` }] };
        }
    );
}
