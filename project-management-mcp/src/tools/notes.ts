import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api } from '../api-client.js';

export function registerNoteTools(server: McpServer): void {

    server.tool(
        'list_notes',
        'List notes on a project canvas or a task canvas.',
        {
            projectId:    z.string().optional(),
            parentTaskId: z.string().optional(),
        },
        async ({ projectId, parentTaskId }) => {
            let notes: unknown;
            if (parentTaskId) {
                notes = await api.get(`/notes/by-parent/${parentTaskId}`);
            } else if (projectId) {
                notes = await api.get(`/notes/by-project/${projectId}`);
            } else {
                return { content: [{ type: 'text', text: 'Provide projectId or parentTaskId.' }] };
            }
            return { content: [{ type: 'text', text: JSON.stringify(notes, null, 2) }] };
        }
    );

    server.tool(
        'create_note',
        'Create a new note on a canvas.',
        {
            projectId:       z.string(),
            parentTaskId:    z.string().optional(),
            ancestorTaskIds: z.array(z.string()).optional(),
            title:           z.string(),
            details:         z.string().optional().describe('Markdown — links, bold, italic, lists, headings'),
            backgroundColor: z.string().optional().default('#fdf2c4'),
            x:               z.number().optional().default(100),
            y:               z.number().optional().default(100),
        },
        async ({ projectId, parentTaskId, ancestorTaskIds, title, details, backgroundColor, x, y }) => {
            const note = await api.post('/notes', {
                projectId,
                parentTaskId,
                ancestorTaskIds: ancestorTaskIds ?? [],
                title,
                details: details ?? '',
                backgroundColor,
                layout: { x, y, width: 280, height: 180, zIndex: Date.now() },
            });
            return { content: [{ type: 'text', text: JSON.stringify(note, null, 2) }] };
        }
    );

    server.tool(
        'update_note',
        'Update a note\'s title, details, or background color.',
        {
            noteId:          z.string(),
            title:           z.string().optional(),
            details:         z.string().optional().describe('Markdown — links, bold, italic, lists, headings'),
            backgroundColor: z.string().optional(),
        },
        async ({ noteId, ...fields }) => {
            const note = await api.put(`/notes/${noteId}`, fields);
            return { content: [{ type: 'text', text: JSON.stringify(note, null, 2) }] };
        }
    );

}
