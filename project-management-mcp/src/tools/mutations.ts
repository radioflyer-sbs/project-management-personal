import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api } from '../api-client.js';
import { computeGroupLayout } from '../group-layout.js';

const ITEM_APIS: Record<string, string> = {
    task:              'tasks',
    note:              'notes',
    group:             'groups',
    dashboard:         'dashboards',
    project:           'projects',
    'data-definition': 'data-definitions',
};

export function registerMutationTools(server: McpServer): void {

    server.tool(
        'delete_item',
        'Delete any item by type and id. Groups release member tasks back to canvas; tasks cascade-delete their subtrees.',
        {
            type: z.enum(['task', 'note', 'group', 'dashboard', 'project', 'data-definition']),
            id:   z.string().describe('MongoDB _id of the item'),
        },
        async ({ type, id }) => {
            await api.delete(`/${ITEM_APIS[type]}/${id}`);
            return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
        }
    );

    server.tool(
        'move_item',
        'Move and/or resize any canvas card. For groups, member tasks are reflowed automatically.',
        {
            type:   z.enum(['task', 'note', 'group', 'dashboard']),
            id:     z.string().describe('MongoDB _id of the item'),
            x:      z.number().describe('New canvas x in pixels'),
            y:      z.number().describe('New canvas y in pixels'),
            width:  z.number().optional().describe('New width in pixels (preserved if omitted)'),
            height: z.number().optional().describe('New height in pixels (preserved if omitted)'),
        },
        async ({ type, id, x, y, width, height }) => {
            if (type === 'group') {
                const group = await api.get(`/groups/${id}`) as any;
                const memberIds: string[] = group.itemIds ?? [];
                const baseLayout = {
                    ...group.layout,
                    x, y,
                    ...(width  !== undefined ? { width  } : {}),
                    ...(height !== undefined ? { height } : {}),
                };
                const { groupLayout, itemLayouts } = computeGroupLayout(
                    baseLayout,
                    group.layoutDirection ?? 'vertical',
                    group.layoutWrap ?? false,
                    memberIds.length,
                );
                await api.put(`/groups/${id}`, { layout: groupLayout });
                await Promise.all(memberIds.map(async (taskId, i) => {
                    const task = await api.get(`/tasks/${taskId}`) as any;
                    return api.put(`/tasks/${taskId}`, { layout: { ...task.layout, ...itemLayouts[i] } });
                }));
                return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
            }

            const base = ITEM_APIS[type];
            const item = await api.get(`/${base}/${id}`) as any;
            const layout = {
                ...item.layout,
                x, y,
                ...(width  !== undefined ? { width  } : {}),
                ...(height !== undefined ? { height } : {}),
            };
            await api.put(`/${base}/${id}`, { layout });
            return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
        }
    );

    server.tool(
        'reparent_item',
        'Move an item to a different workspace by changing its owning parent task. '
        + 'Pass newParentTaskId to make the item a child of that task, or null to move it to the project root. '
        + 'The item keeps its layout (same coordinates in the destination). Tasks carry their whole subtree; '
        + 'groups carry their member tasks. Use this for "promote" (move up to the parent\'s parent) and '
        + '"make child" (move under another task) operations.',
        {
            type:            z.enum(['task', 'note', 'group', 'dashboard']),
            id:              z.string().describe('MongoDB _id of the item to move'),
            newParentTaskId: z.string().nullable().describe('MongoDB _id of the new parent task, or null for the project root'),
        },
        async ({ type, id, newParentTaskId }) => {
            const updated = await api.put(`/${ITEM_APIS[type]}/${id}/reparent`, { newParentTaskId });
            return { content: [{ type: 'text', text: JSON.stringify(updated) }] };
        }
    );

    server.tool(
        'set_metrics',
        'Push multiple metric values in one call. Each update broadcasts over Socket.IO. Returns updated count and per-metric errors.',
        {
            projectId: z.string(),
            metrics: z.array(z.object({
                id:    z.string().describe('Project-scoped metric id'),
                value: z.union([z.number(), z.string(), z.boolean(), z.array(z.string()), z.null()]),
            })).min(1),
        },
        async ({ projectId, metrics }) => {
            let updated = 0;
            const errors: Array<{ id: string; message: string }> = [];
            await Promise.all(metrics.map(async ({ id, value }) => {
                try {
                    await api.post(`/data-definitions/by-project/${projectId}/id/${id}/value`, { value });
                    updated++;
                } catch (err: any) {
                    errors.push({ id, message: err.message ?? 'Unknown error' });
                }
            }));
            return { content: [{ type: 'text', text: JSON.stringify({ updated, errors }) }] };
        }
    );
}
