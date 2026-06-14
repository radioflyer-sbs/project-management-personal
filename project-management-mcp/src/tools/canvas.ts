import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api } from '../api-client.js';
import { computeGroupLayout } from '../group-layout.js';

/** Canvas-space visible area given a saved viewState and a screen viewport size. */
function visibleBounds(panX: number, panY: number, zoom: number, vpW: number, vpH: number) {
    return {
        minX: -panX / zoom,
        minY: -panY / zoom,
        maxX: (vpW - panX) / zoom,
        maxY: (vpH - panY) / zoom,
    };
}

function isVisible(
    layout: { x: number; y: number; width: number; height: number },
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
): boolean {
    return layout.x < bounds.maxX && layout.x + layout.width  > bounds.minX
        && layout.y < bounds.maxY && layout.y + layout.height > bounds.minY;
}

export function registerCanvasTools(server: McpServer): void {

    server.tool(
        'get_current_view',
        'Returns which canvas the user is currently looking at, the saved pan/zoom (viewState), and a list of every card on that canvas with a flag indicating whether it falls within the visible viewport. ' +
        'The viewState is persisted to the database on every pan/zoom gesture (debounced 1 s), so it closely reflects what is actually on screen. ' +
        'Provide viewportWidth and viewportHeight if you know the user\'s screen resolution (defaults to 1920×1080). ' +
        'Note: this data is written by the browser whenever the user navigates to a different canvas, so it reflects the last canvas the browser had open.',
        {
            viewportWidth:  z.number().optional().default(1920).describe('Browser viewport width in CSS pixels (default 1920)'),
            viewportHeight: z.number().optional().default(1080).describe('Browser viewport height in CSS pixels (default 1080)'),
        },
        async ({ viewportWidth, viewportHeight }) => {
            // 1. Read the stored current-view record.
            const stateEntry = await api.get('/app-state/current-view').catch(() => null) as any;
            if (!stateEntry) {
                return { content: [{ type: 'text', text: 'No current-view recorded yet. The user must open the app and navigate to a canvas first.' }] };
            }

            const { projectId, parentTaskId, ancestorTaskIds, title } = stateEntry.value as {
                projectId: string;
                parentTaskId: string | null;
                ancestorTaskIds: string[];
                title: string;
            };

            // 2. Fetch the viewState (panX, panY, zoom) from the host document.
            let viewState: { panX: number; panY: number; zoom: number } = { panX: 0, panY: 0, zoom: 1 };
            try {
                if (parentTaskId) {
                    const task = await api.get(`/tasks/${parentTaskId}`) as any;
                    if (task?.viewState) { viewState = task.viewState; }
                } else {
                    const project = await api.get(`/projects/${projectId}`) as any;
                    if (project?.viewState) { viewState = project.viewState; }
                }
            } catch { /* keep defaults */ }

            // 3. Fetch all items on this canvas.
            const [tasks, notes, groups, dashboards] = await Promise.all([
                parentTaskId
                    ? api.get(`/tasks/by-parent/${parentTaskId}/with-projections`)
                    : api.get(`/tasks/by-project/${projectId}/with-projections`),
                parentTaskId
                    ? api.get(`/notes/by-parent/${parentTaskId}`)
                    : api.get(`/notes/by-project/${projectId}`),
                parentTaskId
                    ? api.get(`/groups/by-parent/${parentTaskId}`)
                    : api.get(`/groups/by-project/${projectId}`),
                parentTaskId
                    ? api.get(`/dashboards/by-parent/${parentTaskId}`)
                    : api.get(`/dashboards/by-project/${projectId}`),
            ]);

            // 4. Compute visible viewport bounds in canvas coordinates.
            const vpW = viewportWidth ?? 1920;
            const vpH = viewportHeight ?? 1080;
            const bounds = visibleBounds(viewState.panX, viewState.panY, viewState.zoom, vpW, vpH);

            const annotate = (item: any) => ({
                ...item,
                visibleInViewport: isVisible(item.layout, bounds),
            });

            const result = {
                canvas: {
                    title,
                    projectId,
                    parentTaskId: parentTaskId ?? null,
                    ancestorTaskIds: ancestorTaskIds ?? [],
                },
                viewState: {
                    ...viewState,
                    visibleCanvasBounds: {
                        x: Math.round(bounds.minX), y: Math.round(bounds.minY),
                        width: Math.round(bounds.maxX - bounds.minX),
                        height: Math.round(bounds.maxY - bounds.minY),
                    },
                },
                items: {
                    tasks:      (tasks      as any[]).map(t => annotate({ _id: t._id, type: 'task',      title: t.title,  urgency: t.urgency, isComplete: t.isComplete, groupId: t.groupId ?? null, layout: t.layout })),
                    notes:      (notes      as any[]).map(n => annotate({ _id: n._id, type: 'note',      title: n.title,  layout: n.layout })),
                    groups:     (groups     as any[]).map(g => annotate({ _id: g._id, type: 'group',     title: g.title,  layoutDirection: g.layoutDirection, layoutWrap: g.layoutWrap, itemIds: g.itemIds ?? [], layout: g.layout })),
                    dashboards: (dashboards as any[]).map(d => annotate({ _id: d._id, type: 'dashboard', title: d.title,  key: d.key, layout: d.layout })),
                },
            };

            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
    );

    server.tool(
        'get_canvas_layout',
        'Return a complete spatial snapshot of every item on one canvas — tasks, notes, groups, and dashboards — each with its full layout ({ x, y, width, height, zIndex }). Use this before repositioning anything so you can reason about the 2-D arrangement as a whole.',
        {
            projectId:    z.string().optional().describe('Project _id for the project-level canvas'),
            parentTaskId: z.string().optional().describe('Task _id to inspect a task\'s sub-canvas'),
        },
        async ({ projectId, parentTaskId }) => {
            if (!projectId && !parentTaskId) {
                return { content: [{ type: 'text', text: 'Provide projectId or parentTaskId.' }] };
            }

            const [tasks, notes, groups, dashboards] = await Promise.all([
                parentTaskId
                    ? api.get(`/tasks/by-parent/${parentTaskId}/with-projections`)
                    : api.get(`/tasks/by-project/${projectId}/with-projections`),
                parentTaskId
                    ? api.get(`/notes/by-parent/${parentTaskId}`)
                    : api.get(`/notes/by-project/${projectId}`),
                parentTaskId
                    ? api.get(`/groups/by-parent/${parentTaskId}`)
                    : api.get(`/groups/by-project/${projectId}`),
                parentTaskId
                    ? api.get(`/dashboards/by-parent/${parentTaskId}`)
                    : api.get(`/dashboards/by-project/${projectId}`),
            ]);

            const layout = {
                tasks: (tasks as any[]).map(t => ({
                    _id: t._id, title: t.title,
                    urgency: t.urgency, isComplete: t.isComplete,
                    groupId: t.groupId ?? null,
                    layout: t.layout,
                })),
                notes: (notes as any[]).map(n => ({
                    _id: n._id, title: n.title,
                    layout: n.layout,
                })),
                groups: (groups as any[]).map(g => ({
                    _id: g._id, title: g.title,
                    layoutDirection: g.layoutDirection ?? 'vertical',
                    layoutWrap: g.layoutWrap ?? false,
                    itemIds: g.itemIds ?? [],
                    layout: g.layout,
                })),
                dashboards: (dashboards as any[]).map(d => ({
                    _id: d._id, title: d.title, key: d.key,
                    layout: d.layout,
                })),
            };

            return { content: [{ type: 'text', text: JSON.stringify(layout, null, 2) }] };
        }
    );

    const LayoutItemSchema = z.object({
        type:   z.enum(['task', 'note', 'group', 'dashboard']).describe('Card type'),
        id:     z.string().describe('MongoDB _id of the item'),
        x:      z.number().optional().describe('New x position in pixels (preserved if omitted)'),
        y:      z.number().optional().describe('New y position in pixels (preserved if omitted)'),
        width:  z.number().optional().describe('New width in pixels (preserved if omitted)'),
        height: z.number().optional().describe('New height in pixels (preserved if omitted)'),
    });

    server.tool(
        'set_canvas_layouts',
        'Batch-update the position and/or size of multiple canvas items in one call. All four card types (task, note, group, dashboard) can be mixed freely. ' +
        'For group items, member tasks are automatically reflowed using the group\'s layout engine — you do not need to list group members separately. ' +
        'All changes emit real-time Socket.IO updates to the browser.',
        {
            items: z.array(LayoutItemSchema).min(1).describe('Items to reposition or resize. Mix types freely.'),
        },
        async ({ items }) => {
            const results: string[] = [];

            for (const item of items) {
                try {
                    if (item.type === 'task') {
                        const task = await api.get(`/tasks/${item.id}`) as any;
                        const layout = {
                            ...task.layout,
                            ...(item.x      !== undefined ? { x:      item.x      } : {}),
                            ...(item.y      !== undefined ? { y:      item.y      } : {}),
                            ...(item.width  !== undefined ? { width:  item.width  } : {}),
                            ...(item.height !== undefined ? { height: item.height } : {}),
                        };
                        await api.put(`/tasks/${item.id}`, { layout });
                        results.push(`task ${item.id} → (${layout.x}, ${layout.y}) ${layout.width}×${layout.height}`);

                    } else if (item.type === 'note') {
                        const note = await api.get(`/notes/${item.id}`) as any;
                        const layout = {
                            ...note.layout,
                            ...(item.x      !== undefined ? { x:      item.x      } : {}),
                            ...(item.y      !== undefined ? { y:      item.y      } : {}),
                            ...(item.width  !== undefined ? { width:  item.width  } : {}),
                            ...(item.height !== undefined ? { height: item.height } : {}),
                        };
                        await api.put(`/notes/${item.id}`, { layout });
                        results.push(`note ${item.id} → (${layout.x}, ${layout.y}) ${layout.width}×${layout.height}`);

                    } else if (item.type === 'dashboard') {
                        const dashboard = await api.get(`/dashboards/${item.id}`) as any;
                        const layout = {
                            ...dashboard.layout,
                            ...(item.x      !== undefined ? { x:      item.x      } : {}),
                            ...(item.y      !== undefined ? { y:      item.y      } : {}),
                            ...(item.width  !== undefined ? { width:  item.width  } : {}),
                            ...(item.height !== undefined ? { height: item.height } : {}),
                        };
                        await api.put(`/dashboards/${item.id}`, { layout });
                        results.push(`dashboard ${item.id} → (${layout.x}, ${layout.y}) ${layout.width}×${layout.height}`);

                    } else if (item.type === 'group') {
                        const group = await api.get(`/groups/${item.id}`) as any;
                        const memberIds: string[] = group.itemIds ?? [];
                        const baseLayout = {
                            ...group.layout,
                            ...(item.x      !== undefined ? { x:      item.x      } : {}),
                            ...(item.y      !== undefined ? { y:      item.y      } : {}),
                            ...(item.width  !== undefined ? { width:  item.width  } : {}),
                            ...(item.height !== undefined ? { height: item.height } : {}),
                        };
                        const { groupLayout, itemLayouts } = computeGroupLayout(
                            baseLayout,
                            group.layoutDirection ?? 'vertical',
                            group.layoutWrap ?? false,
                            memberIds.length,
                        );
                        await api.put(`/groups/${item.id}`, { layout: groupLayout });
                        await Promise.all(memberIds.map(async (taskId, i) => {
                            const task = await api.get(`/tasks/${taskId}`) as any;
                            return api.put(`/tasks/${taskId}`, { layout: { ...task.layout, ...itemLayouts[i] } });
                        }));
                        results.push(`group ${item.id} → (${groupLayout.x}, ${groupLayout.y}) ${groupLayout.width}×${groupLayout.height}, ${memberIds.length} member(s) reflowed`);
                    }
                } catch (err: any) {
                    results.push(`${item.type} ${item.id}: ERROR — ${err.message}`);
                }
            }

            return { content: [{ type: 'text', text: results.join('\n') }] };
        }
    );
}
