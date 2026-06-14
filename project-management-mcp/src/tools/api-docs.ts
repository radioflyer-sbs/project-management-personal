import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getApiBaseUrl } from '../api-client.js';

// ── Shared type used in the endpoint catalogue ────────────────────────────────

interface Endpoint {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;          // e.g. "/api/tasks/:id"
    description: string;
    pathParams?: Record<string, string>;
    body?: unknown;        // JSON-serialisable schema description
    response: string;
    notes?: string;
}

// ── Per-category endpoint catalogues ─────────────────────────────────────────

const ENDPOINTS: Record<string, Endpoint[]> = {

    projects: [
        {
            method: 'GET', path: '/api/projects',
            description: 'List all projects.',
            response: 'Project[]',
        },
        {
            method: 'GET', path: '/api/projects/:id',
            description: 'Get a single project by MongoDB _id.',
            pathParams: { id: 'MongoDB _id of the project' },
            response: 'Project',
        },
        {
            method: 'POST', path: '/api/projects',
            description: 'Create a new project.',
            body: { name: 'string (required)', description: 'string (optional)' },
            response: 'Project (201)',
        },
        {
            method: 'PUT', path: '/api/projects/:id',
            description: 'Update a project.',
            pathParams: { id: 'MongoDB _id of the project' },
            body: {
                name: 'string (optional)',
                description: 'string (optional)',
                viewState: '{ panX: number, panY: number, zoom: number } (optional) — saved canvas pan/zoom',
            },
            response: 'Project',
        },
        {
            method: 'DELETE', path: '/api/projects/:id',
            description: 'Delete a project and all its contents (cascade).',
            pathParams: { id: 'MongoDB _id of the project' },
            response: '204 No Content',
        },
    ],

    tasks: [
        {
            method: 'GET', path: '/api/tasks/by-project/:projectId/with-projections',
            description: 'List top-level tasks on a project canvas. Includes projectedChildren on each task.',
            pathParams: { projectId: 'MongoDB _id of the project' },
            response: 'Task[] (with projectedChildren populated)',
        },
        {
            method: 'GET', path: '/api/tasks/by-parent/:parentTaskId/with-projections',
            description: 'List tasks on a task sub-canvas. Includes projectedChildren on each task.',
            pathParams: { parentTaskId: 'MongoDB _id of the parent task' },
            response: 'Task[] (with projectedChildren populated)',
        },
        {
            method: 'GET', path: '/api/tasks/:id',
            description: 'Get a single task by MongoDB _id.',
            pathParams: { id: 'MongoDB _id of the task' },
            response: 'Task',
        },
        {
            method: 'POST', path: '/api/tasks/counts-for-ids',
            description: 'Read-only. Get direct and total sub-task counts for a list of task IDs.',
            body: { taskIds: 'string[] — MongoDB _ids' },
            response: '{ [taskId]: { direct: number, total: number } }',
            notes: 'This is a read-only action POST. It does NOT emit a socket data-changed event.',
        },
        {
            method: 'POST', path: '/api/tasks',
            description: 'Create a new task.',
            body: {
                projectId: 'string (required)',
                parentTaskId: 'string (optional) — omit for project canvas',
                ancestorTaskIds: 'string[] (default [])',
                title: 'string (required)',
                description: 'string (default "")',
                urgency: '"long-term-goal"|"low"|"normal"|"important"|"urgent"|"immediate" (default "normal")',
                isComplete: 'boolean (default false)',
                projectToParent: 'boolean (optional) — show in parent card projected list',
                layout: '{ x: number, y: number, width: number, height: number, zIndex: number } (required)',
            },
            response: 'Task (201)',
        },
        {
            method: 'PUT', path: '/api/tasks/:id',
            description: 'Update a task. All fields are optional; only supplied fields are changed.',
            pathParams: { id: 'MongoDB _id of the task' },
            body: {
                title: 'string (optional)',
                description: 'string (optional)',
                urgency: '"long-term-goal"|"low"|"normal"|"important"|"urgent"|"immediate" (optional)',
                isComplete: 'boolean (optional)',
                projectToParent: 'boolean (optional)',
                layout: '{ x, y, width, height, zIndex } (optional)',
                viewState: '{ panX, panY, zoom } (optional)',
                groupId: 'string|null (optional) — group membership',
                preGroupLayout: '{ x, y, width, height, zIndex }|null (optional)',
            },
            response: 'Task',
            notes: 'PUT bodies containing only "layout" or "viewState" keys are filtered by the server and do NOT emit a socket data-changed event (drag/pan noise suppression). Add the header X-Source: mcp to bypass this filter when you intentionally want a canvas refresh.',
        },
        {
            method: 'DELETE', path: '/api/tasks/:id',
            description: 'Delete a task and all its descendants (sub-tasks, notes, groups, dashboards).',
            pathParams: { id: 'MongoDB _id of the task' },
            response: '204 No Content',
        },
    ],

    notes: [
        {
            method: 'GET', path: '/api/notes/by-project/:projectId',
            description: 'List notes on a project canvas.',
            pathParams: { projectId: 'MongoDB _id of the project' },
            response: 'Note[]',
        },
        {
            method: 'GET', path: '/api/notes/by-parent/:parentTaskId',
            description: 'List notes on a task sub-canvas.',
            pathParams: { parentTaskId: 'MongoDB _id of the parent task' },
            response: 'Note[]',
        },
        {
            method: 'GET', path: '/api/notes/:id',
            description: 'Get a single note.',
            pathParams: { id: 'MongoDB _id of the note' },
            response: 'Note',
        },
        {
            method: 'POST', path: '/api/notes',
            description: 'Create a note.',
            body: {
                projectId: 'string (required)',
                parentTaskId: 'string (optional)',
                ancestorTaskIds: 'string[] (default [])',
                title: 'string (required)',
                details: 'string (optional)',
                backgroundColor: 'string — CSS color (default "#fdf2c4")',
                layout: '{ x, y, width, height, zIndex } (required)',
            },
            response: 'Note (201)',
        },
        {
            method: 'PUT', path: '/api/notes/:id',
            description: 'Update a note.',
            pathParams: { id: 'MongoDB _id of the note' },
            body: {
                title: 'string (optional)',
                details: 'string (optional)',
                backgroundColor: 'string (optional)',
                layout: '{ x, y, width, height, zIndex } (optional)',
            },
            response: 'Note',
        },
        {
            method: 'DELETE', path: '/api/notes/:id',
            description: 'Delete a note.',
            pathParams: { id: 'MongoDB _id of the note' },
            response: '204 No Content',
        },
    ],

    groups: [
        {
            method: 'GET', path: '/api/groups/by-project/:projectId',
            description: 'List groups on a project canvas.',
            pathParams: { projectId: 'MongoDB _id of the project' },
            response: 'Group[]',
        },
        {
            method: 'GET', path: '/api/groups/by-parent/:parentTaskId',
            description: 'List groups on a task sub-canvas.',
            pathParams: { parentTaskId: 'MongoDB _id of the parent task' },
            response: 'Group[]',
        },
        {
            method: 'GET', path: '/api/groups/:id',
            description: 'Get a single group.',
            pathParams: { id: 'MongoDB _id of the group' },
            response: 'Group',
        },
        {
            method: 'POST', path: '/api/groups',
            description: 'Create a group.',
            body: {
                projectId: 'string (required)',
                parentTaskId: 'string (optional)',
                title: 'string (default "Group")',
                layout: '{ x, y, width, height, zIndex } (required)',
                itemIds: 'string[] (default []) — ordered member task _ids',
                layoutDirection: '"vertical"|"horizontal" (default "vertical")',
                layoutWrap: 'boolean (default false)',
            },
            response: 'Group (201)',
        },
        {
            method: 'PUT', path: '/api/groups/:id',
            description: 'Update a group.',
            pathParams: { id: 'MongoDB _id of the group' },
            body: {
                title: 'string (optional)',
                layout: '{ x, y, width, height, zIndex } (optional)',
                itemIds: 'string[] (optional) — full ordered member list (replace, not append)',
                layoutDirection: '"vertical"|"horizontal" (optional)',
                layoutWrap: 'boolean (optional)',
            },
            response: 'Group',
            notes: 'When itemIds is updated, the server does NOT automatically reflow member task positions. The caller must also PUT each member task\'s layout.',
        },
        {
            method: 'DELETE', path: '/api/groups/:id',
            description: 'Delete a group. Member tasks have their groupId and preGroupLayout cleared automatically; they remain on the canvas.',
            pathParams: { id: 'MongoDB _id of the group' },
            response: '204 No Content',
        },
    ],

    'data-definitions': [
        {
            method: 'GET', path: '/api/data-definitions/by-project/:projectId',
            description: 'List all data definitions for a project.',
            pathParams: { projectId: 'MongoDB _id of the project' },
            response: 'DataDefinition[]',
        },
        {
            method: 'GET', path: '/api/data-definitions/by-project/:projectId/id/:id',
            description: 'Get a single data definition by its project-scoped string id.',
            pathParams: {
                projectId: 'MongoDB _id of the project',
                id: 'User-assigned string id of the definition (e.g. "build-status")',
            },
            response: 'DataDefinition',
        },
        {
            method: 'GET', path: '/api/data-definitions/:mongoId',
            description: 'Get a single data definition by MongoDB _id.',
            pathParams: { mongoId: 'MongoDB _id of the definition' },
            response: 'DataDefinition',
        },
        {
            method: 'POST', path: '/api/data-definitions',
            description: 'Create a data definition. The id must be unique within the project.',
            body: {
                projectId: 'string (required)',
                id: 'string (required) — user-assigned stable key, e.g. "build-status"',
                label: 'string (optional) — display label',
                valueType: '"number"|"text"|"boolean"|"enum"|"timestamp"|"list" (required)',
                value: 'number|string|boolean|string[]|null (required)',
                options: {
                    unit: 'string (optional) — displayed after numeric values',
                    min: 'number (optional) — for progress/gauge widgets',
                    max: 'number (optional) — for progress/gauge widgets',
                    enumOptions: 'string[] (optional) — allowed values for enum type',
                },
            },
            response: 'DataDefinition (201)',
            notes: 'Returns 409 if the id already exists in this project.',
        },
        {
            method: 'PUT', path: '/api/data-definitions/:mongoId',
            description: 'Update a data definition\'s label, value, or options.',
            pathParams: { mongoId: 'MongoDB _id of the definition' },
            body: {
                label: 'string (optional)',
                value: 'number|string|boolean|string[]|null (optional)',
                options: '{ unit?, min?, max?, enumOptions? } (optional)',
            },
            response: 'DataDefinition',
        },
        {
            method: 'POST', path: '/api/data-definitions/by-project/:projectId/id/:id/value',
            description: 'Hot-path: set a metric value. Broadcasts a Socket.IO data-changed event.',
            pathParams: {
                projectId: 'MongoDB _id of the project',
                id: 'User-assigned string id of the definition',
            },
            body: { value: 'number|string|boolean|string[]|null (required)' },
            response: 'DataDefinition',
            notes: 'This is the preferred way to push live metric updates. It always emits a socket event regardless of the noise-suppression guards.',
        },
        {
            method: 'DELETE', path: '/api/data-definitions/:mongoId',
            description: 'Delete a data definition.',
            pathParams: { mongoId: 'MongoDB _id of the definition' },
            response: '204 No Content',
        },
    ],

    dashboards: [
        {
            method: 'GET', path: '/api/dashboards/by-project/:projectId',
            description: 'List dashboards on a project canvas.',
            pathParams: { projectId: 'MongoDB _id of the project' },
            response: 'Dashboard[]',
        },
        {
            method: 'GET', path: '/api/dashboards/by-parent/:parentTaskId',
            description: 'List dashboards on a task sub-canvas.',
            pathParams: { parentTaskId: 'MongoDB _id of the parent task' },
            response: 'Dashboard[]',
        },
        {
            method: 'GET', path: '/api/dashboards/by-project/:projectId/key/:key',
            description: 'Get a dashboard by its project-scoped string key.',
            pathParams: {
                projectId: 'MongoDB _id of the project',
                key: 'Unique per-project string key',
            },
            response: 'Dashboard',
        },
        {
            method: 'GET', path: '/api/dashboards/:id',
            description: 'Get a dashboard by MongoDB _id.',
            pathParams: { id: 'MongoDB _id of the dashboard' },
            response: 'Dashboard',
        },
        {
            method: 'POST', path: '/api/dashboards',
            description: 'Create a dashboard.',
            body: {
                projectId: 'string (required)',
                parentTaskId: 'string (optional)',
                ancestorTaskIds: 'string[] (default [])',
                title: 'string (default "Dashboard")',
                key: 'string (required) — unique per project',
                layout: '{ x, y, width, height, zIndex } (required)',
                config: {
                    widgets: 'Widget[] (default []) — see widget schema below',
                },
            },
            response: 'Dashboard (201)',
            notes: 'Returns 409 if the key already exists in the project or if widget ids are duplicated. Returns 422 if any widget dataId does not resolve to an existing data definition in the project.',
        },
        {
            method: 'PUT', path: '/api/dashboards/:id',
            description: 'Update a dashboard (title, layout, or full widget list).',
            pathParams: { id: 'MongoDB _id of the dashboard' },
            body: {
                title: 'string (optional)',
                layout: '{ x, y, width, height, zIndex } (optional)',
                config: '{ widgets: Widget[] } (optional) — replaces the entire widget list',
            },
            response: 'Dashboard',
        },
        {
            method: 'DELETE', path: '/api/dashboards/:id',
            description: 'Delete a dashboard.',
            pathParams: { id: 'MongoDB _id of the dashboard' },
            response: '204 No Content',
        },
    ],

    'app-state': [
        {
            method: 'GET', path: '/api/app-state/:key',
            description: 'Read a generic app-state entry by key.',
            pathParams: { key: 'Arbitrary string key, e.g. "current-view"' },
            response: '{ key: string, value: any, updatedAt: string } or 404',
            notes: 'The well-known key "current-view" stores { projectId, parentTaskId, ancestorTaskIds, title } and is written by the browser on every canvas navigation.',
        },
        {
            method: 'PUT', path: '/api/app-state/:key',
            description: 'Upsert a generic app-state entry by key.',
            pathParams: { key: 'Arbitrary string key' },
            body: { value: 'any — the value to store' },
            response: '{ key, value, updatedAt }',
            notes: 'App-state writes do NOT emit socket data-changed events.',
        },
    ],
};

const WIDGET_SCHEMA = {
    id: 'string (required) — unique within the dashboard',
    dataId: 'string (required) — references a DataDefinition.id (not MongoDB _id) in the same project',
    type: '"number"|"progress"|"gauge"|"status"|"text"|"toggle"|"list" (required)',
    label: 'string (optional)',
    icon: 'string (optional) — PrimeIcons class suffix, e.g. "pi-check-circle"',
    editable: 'boolean (set to false; field is legacy and has no current effect)',
    options: {
        format: 'string (optional)',
        colorThresholds: '{ value: number, color: string }[] (optional)',
        suffix: 'string (optional)',
        prefix: 'string (optional)',
    },
};

const CATEGORIES = Object.keys(ENDPOINTS) as Array<keyof typeof ENDPOINTS>;

// ── Tool registration ─────────────────────────────────────────────────────────

export function registerApiDocTools(server: McpServer): void {

    server.tool(
        'get_api_info',
        'Returns the server base URL, authentication model, content-type requirements, Socket.IO event details, and a list of available API categories. Read this first before calling get_api_endpoints.',
        {},
        async () => {
            const baseUrl = getApiBaseUrl();
            const info = {
                baseUrl,
                authentication: {
                    required: false,
                    notes: 'The application is single-user with no authentication. All endpoints are open. No Authorization header is required. When auth is added in the future, this field will describe the scheme.',
                },
                headers: {
                    'Content-Type': 'application/json — required on POST and PUT requests',
                    'X-Source': 'Set to "mcp" on any request that should always trigger a browser refresh (Socket.IO data-changed event), even if the body contains only layout or viewState fields. Omit on regular scripted calls.',
                },
                socketIO: {
                    url: baseUrl.replace('/api', ''),
                    event: 'data-changed',
                    description: 'Emitted after every successful content-mutating request (POST/PUT/DELETE). Subscribe to this event to receive live updates. Read-only POSTs, layout/viewState-only PUTs, and app-state writes are suppressed.',
                },
                availableCategories: CATEGORIES,
                usage: 'Call get_api_endpoints with one of the category names to see the full endpoint list for that category.',
            };
            return { content: [{ type: 'text', text: JSON.stringify(info, null, 2) }] };
        }
    );

    server.tool(
        'get_api_endpoints',
        'Returns the complete REST endpoint reference for one API category, including HTTP method, full path, request body schema, response shape, and any important caveats. Call get_api_info first to see available categories.',
        {
            category: z.enum(CATEGORIES as [string, ...string[]]).describe(
                `API category to look up. One of: ${CATEGORIES.join(', ')}`
            ),
        },
        async ({ category }) => {
            const endpoints = ENDPOINTS[category];
            const baseUrl = getApiBaseUrl();

            const result = {
                category,
                baseUrl,
                endpoints: endpoints.map(ep => ({
                    ...ep,
                    fullUrl: `${baseUrl}${ep.path}`,
                })),
                ...(category === 'dashboards' ? { widgetSchema: WIDGET_SCHEMA } : {}),
            };

            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
    );
}
