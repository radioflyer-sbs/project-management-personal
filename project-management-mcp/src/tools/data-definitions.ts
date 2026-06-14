import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api } from '../api-client.js';

const ValueTypeEnum = z.enum(['number', 'text', 'boolean', 'enum', 'timestamp', 'list']);

export function registerDataDefinitionTools(server: McpServer): void {

    server.tool(
        'list_data_definitions',
        'Enumerate all data definitions (metrics) for a project. Returns id, label, valueType, and current value for each — use this to discover what metrics are available before creating widgets.',
        { projectId: z.string().describe('MongoDB _id of the project') },
        async ({ projectId }) => {
            const defs = await api.get(`/data-definitions/by-project/${projectId}`);
            return { content: [{ type: 'text', text: JSON.stringify(defs, null, 2) }] };
        }
    );

    server.tool(
        'get_data_definition',
        'Get a single data definition by its project-scoped string id (not MongoDB _id).',
        {
            projectId: z.string(),
            id:        z.string().describe('The project-scoped string id (e.g. "build-status")'),
        },
        async ({ projectId, id }) => {
            const def = await api.get(`/data-definitions/by-project/${projectId}/id/${id}`);
            return { content: [{ type: 'text', text: JSON.stringify(def, null, 2) }] };
        }
    );

    server.tool(
        'create_data_definition',
        'Define a new metric for a project. The id must be unique within the project (409 if taken).',
        {
            projectId: z.string(),
            id:        z.string().describe('Unique per-project string id — the stable address for all value reads/writes'),
            label:     z.string().optional().describe('Human-readable name'),
            valueType: ValueTypeEnum,
            value:     z.union([z.number(), z.string(), z.boolean(), z.array(z.string()), z.null()])
                          .describe('Initial value; must match valueType'),
            options:   z.object({
                unit:        z.string().optional(),
                min:         z.number().optional(),
                max:         z.number().optional(),
                enumOptions: z.array(z.string()).optional(),
            }).optional(),
        },
        async ({ projectId, id, label, valueType, value, options }) => {
            const def = await api.post('/data-definitions', { projectId, id, label, valueType, value, options });
            return { content: [{ type: 'text', text: JSON.stringify(def, null, 2) }] };
        }
    );

    server.tool(
        'update_data_definition',
        'Update a data definition\'s label or options. Note: the id is immutable.',
        {
            mongoId: z.string().describe('MongoDB _id of the data definition (from list_data_definitions)'),
            label:   z.string().optional(),
            options: z.object({
                unit:        z.string().optional(),
                min:         z.number().optional(),
                max:         z.number().optional(),
                enumOptions: z.array(z.string()).optional(),
            }).optional(),
        },
        async ({ mongoId, ...fields }) => {
            const def = await api.put(`/data-definitions/${mongoId}`, fields);
            return { content: [{ type: 'text', text: JSON.stringify(def, null, 2) }] };
        }
    );

    server.tool(
        'set_data_value',
        'Hot path: set a metric\'s current value by (projectId, id). Broadcasts over Socket.IO so every widget showing this metric updates immediately.',
        {
            projectId: z.string(),
            id:        z.string().describe('The project-scoped string id of the metric'),
            value:     z.union([z.number(), z.string(), z.boolean(), z.array(z.string()), z.null()])
                          .describe('New value — must conform to the metric\'s valueType'),
        },
        async ({ projectId, id, value }) => {
            const def = await api.post(`/data-definitions/by-project/${projectId}/id/${id}/value`, { value });
            return { content: [{ type: 'text', text: JSON.stringify(def, null, 2) }] };
        }
    );

}
