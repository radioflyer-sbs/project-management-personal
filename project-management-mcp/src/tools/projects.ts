import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api } from '../api-client.js';

export function registerProjectTools(server: McpServer): void {

    server.tool(
        'list_projects',
        'List all projects in the application.',
        {},
        async () => {
            const projects = await api.get('/projects');
            return { content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }] };
        }
    );

    server.tool(
        'get_project',
        'Get a single project by its MongoDB ID.',
        { projectId: z.string().describe('MongoDB _id of the project') },
        async ({ projectId }) => {
            const project = await api.get(`/projects/${projectId}`);
            return { content: [{ type: 'text', text: JSON.stringify(project, null, 2) }] };
        }
    );

    server.tool(
        'create_project',
        'Create a new project.',
        {
            name:        z.string().describe('Project name'),
            description: z.string().optional().describe('Project description'),
        },
        async ({ name, description }) => {
            const project = await api.post('/projects', { name, description: description ?? '' });
            return { content: [{ type: 'text', text: JSON.stringify(project, null, 2) }] };
        }
    );

    server.tool(
        'update_project',
        'Update a project\'s name or description.',
        {
            projectId:   z.string().describe('MongoDB _id of the project'),
            name:        z.string().optional(),
            description: z.string().optional(),
        },
        async ({ projectId, name, description }) => {
            const project = await api.put(`/projects/${projectId}`, { name, description });
            return { content: [{ type: 'text', text: JSON.stringify(project, null, 2) }] };
        }
    );

}
