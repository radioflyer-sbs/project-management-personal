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
            description:     z.string().optional().describe('Markdown — links, bold, italic, lists, headings'),
            urgency:         UrgencyEnum.optional().default('normal'),
            isComplete:      z.boolean().optional().default(false),
            dueDate:         z.string().datetime().optional().describe('ISO 8601 due date/time; drives the card countdown'),
            projectToParent: z.boolean().optional().describe('Show this task in its parent\'s projected-children list'),
            x:               z.number().optional().default(100),
            y:               z.number().optional().default(100),
        },
        async ({ projectId, parentTaskId, ancestorTaskIds, title, description, urgency, isComplete, dueDate, projectToParent, x, y }) => {
            const task = await api.post('/tasks', {
                projectId,
                parentTaskId,
                ancestorTaskIds: ancestorTaskIds ?? [],
                title,
                description: description ?? '',
                urgency,
                isComplete,
                dueDate,
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
            description:     z.string().optional().describe('Markdown — links, bold, italic, lists, headings'),
            urgency:         UrgencyEnum.optional(),
            isComplete:      z.boolean().optional(),
            dueDate:         z.string().datetime().nullable().optional().describe('ISO 8601 due date/time; null clears it'),
            projectToParent: z.boolean().optional(),
        },
        async ({ taskId, ...fields }) => {
            const task = await api.put(`/tasks/${taskId}`, fields);
            return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
        }
    );

}
