import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api } from '../api-client.js';
import { computeGroupLayout, DEFAULT_GROUP_WIDTH, DEFAULT_GROUP_HEIGHT } from '../group-layout.js';

export function registerGroupTools(server: McpServer): void {

    server.tool(
        'list_groups',
        'List groups on a canvas.',
        {
            projectId:    z.string().optional(),
            parentTaskId: z.string().optional(),
        },
        async ({ projectId, parentTaskId }) => {
            let groups: unknown;
            if (parentTaskId) {
                groups = await api.get(`/groups/by-parent/${parentTaskId}`);
            } else if (projectId) {
                groups = await api.get(`/groups/by-project/${projectId}`);
            } else {
                return { content: [{ type: 'text', text: 'Provide projectId or parentTaskId.' }] };
            }
            return { content: [{ type: 'text', text: JSON.stringify(groups, null, 2) }] };
        }
    );

    server.tool(
        'create_group',
        'Create a new group container on a canvas.',
        {
            projectId:       z.string(),
            parentTaskId:    z.string().optional(),
            title:           z.string().optional().default('Group'),
            layoutDirection: z.enum(['vertical', 'horizontal']).optional().default('vertical'),
            layoutWrap:      z.boolean().optional().default(false),
            x:               z.number().optional().default(100),
            y:               z.number().optional().default(100),
        },
        async ({ projectId, parentTaskId, title, layoutDirection, layoutWrap, x, y }) => {
            const group = await api.post('/groups', {
                projectId,
                parentTaskId,
                title,
                layoutDirection,
                layoutWrap,
                itemIds: [],
                layout: { x, y, width: DEFAULT_GROUP_WIDTH, height: DEFAULT_GROUP_HEIGHT, zIndex: 1 },
            });
            return { content: [{ type: 'text', text: JSON.stringify(group, null, 2) }] };
        }
    );

    server.tool(
        'update_group',
        'Update a group\'s title, layout direction, or wrap setting.',
        {
            groupId:         z.string(),
            title:           z.string().optional(),
            layoutDirection: z.enum(['vertical', 'horizontal']).optional(),
            layoutWrap:      z.boolean().optional(),
        },
        async ({ groupId, ...fields }) => {
            const group = await api.put(`/groups/${groupId}`, fields);
            return { content: [{ type: 'text', text: JSON.stringify(group, null, 2) }] };
        }
    );

    server.tool(
        'manage_task_group',
        'Add or remove a task from a group. On add, saves the task\'s current layout as preGroupLayout and reflows all members. On remove, restores preGroupLayout and reflows remaining members.',
        {
            taskId:   z.string().describe('MongoDB _id of the task'),
            groupId:  z.string().describe('MongoDB _id of the group'),
            action:   z.enum(['add', 'remove']),
            insertAt: z.number().int().min(0).optional().describe('(add only) 0-based position; omit to append'),
        },
        async ({ taskId, groupId, action, insertAt }) => {
            if (action === 'add') {
                const [task, group] = await Promise.all([
                    api.get(`/tasks/${taskId}`),
                    api.get(`/groups/${groupId}`),
                ]) as any[];

                const existingIds: string[] = group.itemIds ?? [];
                const filteredIds = existingIds.filter((id: string) => id !== taskId);
                const idx = insertAt !== undefined ? Math.min(insertAt, filteredIds.length) : filteredIds.length;
                const newItemIds = [...filteredIds.slice(0, idx), taskId, ...filteredIds.slice(idx)];

                const { groupLayout, itemLayouts } = computeGroupLayout(
                    group.layout,
                    group.layoutDirection ?? 'vertical',
                    group.layoutWrap ?? false,
                    newItemIds.length,
                );

                const memberTasks = await Promise.all(
                    newItemIds.map((id: string) => api.get(`/tasks/${id}`) as Promise<any>)
                );

                await api.put(`/groups/${groupId}`, { itemIds: newItemIds, layout: groupLayout });
                await Promise.all(memberTasks.map(async (t: any, i: number) => {
                    const isNew = (t._id as string) === taskId;
                    const update: Record<string, unknown> = { layout: itemLayouts[i] };
                    if (isNew) {
                        update.groupId = groupId;
                        update.preGroupLayout = t.preGroupLayout ?? { ...t.layout };
                    }
                    return api.put(`/tasks/${t._id}`, update);
                }));

                return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
            }

            // action === 'remove'
            const [task, group] = await Promise.all([
                api.get(`/tasks/${taskId}`),
                api.get(`/groups/${groupId}`),
            ]) as any[];

            const newItemIds: string[] = (group.itemIds ?? []).filter((id: string) => id !== taskId);

            const { groupLayout, itemLayouts } = computeGroupLayout(
                group.layout,
                group.layoutDirection ?? 'vertical',
                group.layoutWrap ?? false,
                newItemIds.length,
            );

            const restoreLayout = task.preGroupLayout
                ? { ...task.preGroupLayout, zIndex: Date.now() }
                : { ...task.layout, zIndex: Date.now() };

            const remainingTasks = await Promise.all(
                newItemIds.map((id: string) => api.get(`/tasks/${id}`) as Promise<any>)
            );

            await api.put(`/groups/${groupId}`, { itemIds: newItemIds, layout: groupLayout });
            await api.put(`/tasks/${taskId}`, { layout: restoreLayout, groupId: null, preGroupLayout: null });
            await Promise.all(
                remainingTasks.map((t: any, i: number) => api.put(`/tasks/${t._id}`, { layout: itemLayouts[i] }))
            );

            return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
        }
    );
}
