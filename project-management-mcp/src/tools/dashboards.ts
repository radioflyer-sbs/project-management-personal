import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api } from '../api-client.js';

/**
 * Widget type ↔ data definition valueType compatibility:
 *   number/progress/gauge → number def   (progress/gauge need def.options.min + max)
 *   status                → enum def     (needs def.options.enumOptions)
 *   text                  → text/timestamp def
 *   toggle                → boolean def
 *   list                  → list def
 *
 * 'editable' has no effect in current UI — set it to false.
 */
const WidgetSchema = z.object({
    id:     z.string().describe('Unique within the dashboard; immutable after creation'),
    dataId: z.string().describe('DataDefinition.id (not MongoDB _id) in the same project'),
    type:   z.enum(['number', 'progress', 'status', 'text', 'list', 'toggle', 'gauge']).describe(
        'number: large value. progress: fill bar (needs min+max). gauge: arc (needs min+max). ' +
        'status: enum pill (needs enumOptions). text: plain string. toggle: bool badge. list: bullet list.'
    ),
    label:    z.string().optional().describe('Display label; defaults to widget id if omitted'),
    icon:     z.string().optional().describe('PrimeIcons class suffix, e.g. "pi-check-circle"'),
    editable: z.boolean().describe('Legacy — no effect; set to false'),
    options:  z.object({
        format:          z.string().optional(),
        colorThresholds: z.array(z.object({ value: z.number(), color: z.string() })).optional(),
        suffix:          z.string().optional(),
        prefix:          z.string().optional(),
    }).optional(),
});

/** True when s looks like a 24-char MongoDB ObjectId hex string. */
function isMongoId(s: string): boolean {
    return /^[0-9a-f]{24}$/i.test(s);
}

export function registerDashboardTools(server: McpServer): void {

    server.tool(
        'list_dashboards',
        'List dashboards on a project or task canvas.',
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
        'Get a dashboard by MongoDB _id or by (projectId, key). Pass a 24-char hex id as identifier to look up by _id; pass a string key and projectId to look up by key.',
        {
            identifier: z.string().describe('MongoDB _id (24-char hex) or project-scoped key string'),
            projectId:  z.string().optional().describe('Required when identifier is a key, not an _id'),
        },
        async ({ identifier, projectId }) => {
            let dashboard: unknown;
            if (isMongoId(identifier)) {
                dashboard = await api.get(`/dashboards/${identifier}`);
            } else {
                if (!projectId) {
                    return { content: [{ type: 'text', text: 'projectId is required when identifier is a key string (not a MongoDB _id).' }] };
                }
                dashboard = await api.get(`/dashboards/by-project/${projectId}/key/${identifier}`);
            }
            return { content: [{ type: 'text', text: JSON.stringify(dashboard, null, 2) }] };
        }
    );

    server.tool(
        'create_dashboard',
        'Create a new dashboard on a canvas. key must be unique per project. Widget dataIds must reference existing data definitions.',
        {
            projectId:       z.string(),
            parentTaskId:    z.string().optional(),
            ancestorTaskIds: z.array(z.string()).optional(),
            title:           z.string(),
            key:             z.string().describe('Unique per-project string key — stable address for lookups'),
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
        'update_dashboard',
        'Update a dashboard\'s title and/or widget config. Provide title to rename; provide config.widgets to fully replace the widget list.',
        {
            dashboardId: z.string().describe('MongoDB _id of the dashboard'),
            title:       z.string().optional(),
            config:      z.object({ widgets: z.array(WidgetSchema) }).optional()
                          .describe('Full widget list replacement — all previous widgets are replaced'),
        },
        async ({ dashboardId, title, config }) => {
            const body: Record<string, unknown> = {};
            if (title   !== undefined) { body['title']  = title;  }
            if (config  !== undefined) { body['config'] = config; }
            const dashboard = await api.put(`/dashboards/${dashboardId}`, body);
            return { content: [{ type: 'text', text: JSON.stringify(dashboard, null, 2) }] };
        }
    );

    server.tool(
        'manage_widget',
        'Add or remove a single widget on a dashboard without touching the other widgets.',
        {
            dashboardId: z.string().describe('MongoDB _id of the dashboard'),
            action:      z.enum(['add', 'remove']),
            widget:      WidgetSchema.optional().describe('(add) Full widget definition'),
            widgetId:    z.string().optional().describe('(remove) Widget id string to remove'),
        },
        async ({ dashboardId, action, widget, widgetId }) => {
            const dashboard = await api.get(`/dashboards/${dashboardId}`) as { config: { widgets: unknown[] } };
            const existing = dashboard.config.widgets as Array<{ id: string }>;

            if (action === 'add') {
                if (!widget) {
                    return { content: [{ type: 'text', text: 'widget is required for action "add".' }] };
                }
                if (existing.some(w => w.id === widget.id)) {
                    return { content: [{ type: 'text', text: `Widget id "${widget.id}" already exists on this dashboard.` }] };
                }
                const updated = await api.put(`/dashboards/${dashboardId}`, {
                    config: { widgets: [...existing, widget] },
                });
                return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] };
            }

            // action === 'remove'
            if (!widgetId) {
                return { content: [{ type: 'text', text: 'widgetId is required for action "remove".' }] };
            }
            const filtered = existing.filter(w => w.id !== widgetId);
            if (filtered.length === existing.length) {
                return { content: [{ type: 'text', text: `Widget id "${widgetId}" not found on this dashboard.` }] };
            }
            const updated = await api.put(`/dashboards/${dashboardId}`, { config: { widgets: filtered } });
            return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] };
        }
    );
}
