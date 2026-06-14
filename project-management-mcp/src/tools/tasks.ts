import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api } from '../api-client.js';

const UrgencyEnum = z.enum(['long-term-goal', 'low', 'normal', 'important', 'urgent', 'immediate']);

export function registerTaskTools(server: McpServer): void {

    server.tool(
        'list_tasks',
        'List tasks on a project canvas or a task canvas. Provide either projectId (for top-level tasks) or parentTaskId (for a task\'s sub-canvas).',
        {
            projectId:    z.string().optional().describe('Project _id — lists top-level tasks'),
            parentTaskId: z.string().optional().describe('Parent task _id — lists children of that task'),
        },
        async ({ projectId, parentTaskId }) => {
            let tasks: unknown;
            if (parentTaskId) {
                tasks = await api.get(`/tasks/by-parent/${parentTaskId}/with-projections`);
            } else if (projectId) {
                tasks = await api.get(`/tasks/by-project/${projectId}/with-projections`);
            } else {
                return { content: [{ type: 'text', text: 'Provide projectId or parentTaskId.' }] };
            }
            return { content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }] };
        }
    );

    server.tool(
        'get_task',
        'Get a single task by its MongoDB _id.',
        { taskId: z.string() },
        async ({ taskId }) => {
            const task = await api.get(`/tasks/${taskId}`);
            return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
        }
    );

    server.tool(
        'create_task',
        'Create a new task on a canvas.',
        {
            projectId:       z.string(),
            parentTaskId:    z.string().optional().describe('Parent task _id for a sub-canvas; omit for project canvas'),
            ancestorTaskIds: z.array(z.string()).optional().describe('Ordered chain of ancestor task ids (from root to parent)'),
            title:           z.string(),
            description:     z.string().optional(),
            urgency:         UrgencyEnum.optional().default('normal'),
            isComplete:      z.boolean().optional().default(false),
            projectToParent: z.boolean().optional().describe('Show this task in its parent\'s projected-children list'),
            x:               z.number().optional().default(100),
            y:               z.number().optional().default(100),
        },
        async ({ projectId, parentTaskId, ancestorTaskIds, title, description, urgency, isComplete, projectToParent, x, y }) => {
            const task = await api.post('/tasks', {
                projectId,
                parentTaskId,
                ancestorTaskIds: ancestorTaskIds ?? [],
                title,
                description: description ?? '',
                urgency,
                isComplete,
                projectToParent,
                layout: { x, y, width: 240, height: 140, zIndex: Date.now() },
            });
            return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
        }
    );

    server.tool(
        'update_task',
        'Update a task\'s fields (title, description, urgency, completion, etc.).',
        {
            taskId:          z.string(),
            title:           z.string().optional(),
            description:     z.string().optional(),
            urgency:         UrgencyEnum.optional(),
            isComplete:      z.boolean().optional(),
            projectToParent: z.boolean().optional(),
        },
        async ({ taskId, ...fields }) => {
            const task = await api.put(`/tasks/${taskId}`, fields);
            return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
        }
    );

    server.tool(
        'move_task',
        'Move and/or resize a task card. x and y are required; width and height are optional and preserve the current value if omitted. Use list_tasks to read current layout before repositioning.',
        {
            taskId: z.string(),
            x:      z.number().describe('New canvas x position in pixels'),
            y:      z.number().describe('New canvas y position in pixels'),
            width:  z.number().optional().describe('New card width in pixels (default 240)'),
            height: z.number().optional().describe('New card height in pixels (default 140)'),
        },
        async ({ taskId, x, y, width, height }) => {
            const task = await api.get(`/tasks/${taskId}`) as any;
            const layout = {
                ...task.layout,
                x, y,
                ...(width  !== undefined ? { width  } : {}),
                ...(height !== undefined ? { height } : {}),
            };
            const updated = await api.put(`/tasks/${taskId}`, { layout });
            return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] };
        }
    );

    server.tool(
        'delete_task',
        'Delete a task and all its descendants (subtasks, notes, etc.).',
        { taskId: z.string() },
        async ({ taskId }) => {
            await api.delete(`/tasks/${taskId}`);
            return { content: [{ type: 'text', text: `Task ${taskId} deleted.` }] };
        }
    );
}
