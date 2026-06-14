import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api } from '../api-client.js';
import { computeGroupLayout, DEFAULT_GROUP_WIDTH, DEFAULT_GROUP_HEIGHT } from '../group-layout.js';

export function registerGroupTools(server: McpServer): void {

    server.tool(
        'list_groups',
        'List groups on a project canvas or a task canvas.',
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
        'add_task_to_group',
        'Add a task to a group. The task is inserted at the end by default, or at a specific 0-based index with insertAt. ' +
        'The group reflows all member positions automatically. The task\'s current layout is saved as preGroupLayout so it can be restored if removed later.',
        {
            taskId:   z.string().describe('MongoDB _id of the task to add'),
            groupId:  z.string().describe('MongoDB _id of the target group'),
            insertAt: z.number().int().min(0).optional().describe('0-based position in the group member list. Omit to append at the end.'),
        },
        async ({ taskId, groupId, insertAt }) => {
            const [task, group] = await Promise.all([
                api.get(`/tasks/${taskId}`),
                api.get(`/groups/${groupId}`),
            ]) as any[];

            const existingIds: string[] = group.itemIds ?? [];
            // Remove if already present (idempotent), then insert at desired position.
            const filteredIds = existingIds.filter((id: string) => id !== taskId);
            const idx = insertAt !== undefined ? Math.min(insertAt, filteredIds.length) : filteredIds.length;
            const newItemIds = [...filteredIds.slice(0, idx), taskId, ...filteredIds.slice(idx)];

            const { groupLayout, itemLayouts } = computeGroupLayout(
                group.layout,
                group.layoutDirection ?? 'vertical',
                group.layoutWrap ?? false,
                newItemIds.length,
            );

            // Fetch the current state of all members so we can preserve their non-layout fields.
            const memberTasks = await Promise.all(
                newItemIds.map((id: string) => api.get(`/tasks/${id}`) as Promise<any>)
            );

            await api.put(`/groups/${groupId}`, { itemIds: newItemIds, layout: groupLayout });

            await Promise.all(memberTasks.map(async (t: any, i: number) => {
                const isNewMember = (t._id as string) === taskId;
                const update: Record<string, unknown> = { layout: itemLayouts[i] };
                if (isNewMember) {
                    update.groupId = groupId;
                    update.preGroupLayout = t.preGroupLayout ?? { ...t.layout };
                }
                return api.put(`/tasks/${t._id}`, update);
            }));

            return {
                content: [{
                    type: 'text',
                    text: `Task ${taskId} added to group ${groupId} at position ${idx}. Group now has ${newItemIds.length} member(s).`,
                }],
            };
        }
    );

    server.tool(
        'remove_task_from_group',
        'Remove a task from a group and release it back onto the canvas. ' +
        'The task\'s position is restored to its pre-group layout (the position it had before joining the group). ' +
        'Remaining group members are reflowed automatically.',
        {
            taskId:  z.string().describe('MongoDB _id of the task to remove'),
            groupId: z.string().describe('MongoDB _id of the group'),
        },
        async ({ taskId, groupId }) => {
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

            // Restore the task to wherever it was before it joined the group.
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

            return {
                content: [{
                    type: 'text',
                    text: `Task ${taskId} removed from group ${groupId}. Restored to canvas at (${restoreLayout.x}, ${restoreLayout.y}). Group now has ${newItemIds.length} member(s).`,
                }],
            };
        }
    );

    server.tool(
        'move_group',
        'Move and/or resize a group container. Member tasks are repositioned using the same reflow engine the UI uses, so their arrangement within the group stays correct. ' +
        'For vertical groups, width is user-controlled and height is auto-computed from member count. ' +
        'For horizontal no-wrap groups, height is user-controlled and width is auto-computed. ' +
        'For horizontal-wrap groups, width is user-controlled and height is auto-computed. ' +
        'Omit width/height to preserve the current values.',
        {
            groupId: z.string(),
            x:       z.number().describe('New canvas x position in pixels'),
            y:       z.number().describe('New canvas y position in pixels'),
            width:   z.number().optional().describe('New group width in pixels (user-controlled for vertical and horizontal-wrap groups)'),
            height:  z.number().optional().describe('New group height in pixels (user-controlled for horizontal no-wrap groups only)'),
        },
        async ({ groupId, x, y, width, height }) => {
            const group = await api.get(`/groups/${groupId}`) as any;
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

            await api.put(`/groups/${groupId}`, { layout: groupLayout });

            await Promise.all(memberIds.map(async (taskId, i) => {
                const task = await api.get(`/tasks/${taskId}`) as any;
                return api.put(`/tasks/${taskId}`, { layout: { ...task.layout, ...itemLayouts[i] } });
            }));

            return { content: [{ type: 'text', text: `Group repositioned to (${x}, ${y}). ${memberIds.length} member task(s) reflowed.` }] };
        }
    );

    server.tool(
        'delete_group',
        'Delete a group (contained tasks are released back to the canvas).',
        { groupId: z.string() },
        async ({ groupId }) => {
            await api.delete(`/groups/${groupId}`);
            return { content: [{ type: 'text', text: `Group ${groupId} deleted.` }] };
        }
    );
}
