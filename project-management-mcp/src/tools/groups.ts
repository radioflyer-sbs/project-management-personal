import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api } from '../api-client.js';

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
                layout: { x, y, width: 340, height: 260, zIndex: 1 },
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
        'delete_group',
        'Delete a group (contained tasks are released back to the canvas).',
        { groupId: z.string() },
        async ({ groupId }) => {
            await api.delete(`/groups/${groupId}`);
            return { content: [{ type: 'text', text: `Group ${groupId} deleted.` }] };
        }
    );
}
