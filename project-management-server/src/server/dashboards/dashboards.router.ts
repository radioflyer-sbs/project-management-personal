import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { DashboardDbService } from '../../database/dashboards/dashboard-db.service';
import { DataDefinitionDbService } from '../../database/data-definitions/data-definition-db.service';
import { ReparentService, ReparentError } from '../../database/reparent.service';
import { DashboardWidget } from '../../model/shared-models/dashboard.model';

const LayoutSchema = z.object({
    x:      z.number(),
    y:      z.number(),
    width:  z.number(),
    height: z.number(),
    zIndex: z.number(),
});

const DashboardWidgetSchema = z.object({
    id:       z.string().min(1),
    dataId:   z.string().min(1),
    type:     z.enum(['number', 'progress', 'status', 'text', 'list', 'toggle', 'gauge']),
    label:    z.string().optional(),
    icon:     z.string().optional(),
    editable: z.boolean(),
    options:  z.object({
        format:           z.string().optional(),
        colorThresholds:  z.array(z.object({ value: z.number(), color: z.string() })).optional(),
        suffix:           z.string().optional(),
        prefix:           z.string().optional(),
    }).optional(),
});

const CreateDashboardSchema = z.object({
    projectId:       z.string().min(1),
    parentTaskId:    z.string().optional(),
    ancestorTaskIds: z.array(z.string()).default([]),
    layout:          LayoutSchema,
    title:           z.string().default('Dashboard'),
    key:             z.string().min(1),
    config:          z.object({ widgets: z.array(DashboardWidgetSchema).default([]) }),
});

const UpdateDashboardSchema = z.object({
    title:  z.string().min(1).optional(),
    layout: LayoutSchema.optional(),
    config: z.object({ widgets: z.array(DashboardWidgetSchema) }).optional(),
});

async function validateWidgets(
    projectId: ObjectId,
    widgets: Array<{ id: string; dataId: string }>,
    dataDefDb: DataDefinitionDbService
): Promise<{ ok: false; status: number; message: string } | { ok: true }> {
    const ids = widgets.map(w => w.id);
    if (new Set(ids).size !== ids.length) {
        return { ok: false, status: 409, message: 'Duplicate widget ids within dashboard' };
    }
    for (const w of widgets) {
        const def = await dataDefDb.findByProjectAndId(projectId, w.dataId);
        if (!def) {
            return { ok: false, status: 422, message: `Unknown dataId '${w.dataId}' in project` };
        }
    }
    return { ok: true };
}

const ReparentSchema = z.object({
    newParentTaskId: z.string().min(1).nullable(),
});

export function createDashboardRouter(
    dashboardDb: DashboardDbService,
    dataDefDb: DataDefinitionDbService,
    reparent: ReparentService,
): Router {
    const router = Router();

    // Moves a dashboard to a new parent task (or to the project root when newParentTaskId is null).
    router.put('/:id/reparent', async (req: Request, res: Response) => {
        const parse = ReparentSchema.safeParse(req.body);
        if (!parse.success) { res.status(400).json({ message: 'Invalid body', errors: parse.error.issues }); return; }
        try {
            const newParent = parse.data.newParentTaskId ? new ObjectId(parse.data.newParentTaskId) : null;
            const updated = await reparent.reparentDashboard(new ObjectId(String(req.params.id)), newParent);
            res.json(updated);
        } catch (err) {
            if (err instanceof ReparentError) { res.status(err.status).json({ message: err.message }); return; }
            res.status(500).json({ message: 'Failed to reparent dashboard' });
        }
    });

    router.get('/by-project/:projectId', async (req: Request, res: Response) => {
        try {
            const dashboards = await dashboardDb.findByProject(new ObjectId(String(req.params.projectId)));
            res.json(dashboards);
        } catch (err) {
            res.status(500).json({ message: 'Failed to load dashboards' });
        }
    });

    router.get('/by-parent/:parentTaskId', async (req: Request, res: Response) => {
        try {
            const dashboards = await dashboardDb.findByParentTask(new ObjectId(String(req.params.parentTaskId)));
            res.json(dashboards);
        } catch (err) {
            res.status(500).json({ message: 'Failed to load dashboards' });
        }
    });

    router.get('/by-project/:projectId/key/:key', async (req: Request, res: Response) => {
        try {
            const dashboard = await dashboardDb.findByProjectAndKey(
                new ObjectId(String(req.params.projectId)),
                String(req.params.key)
            );
            if (!dashboard) { res.status(404).json({ message: 'Dashboard not found' }); return; }
            res.json(dashboard);
        } catch (err) {
            res.status(500).json({ message: 'Failed to load dashboard' });
        }
    });

    router.get('/:id', async (req: Request, res: Response) => {
        try {
            const dashboard = await dashboardDb.findById(new ObjectId(String(req.params.id)));
            if (!dashboard) { res.status(404).json({ message: 'Dashboard not found' }); return; }
            res.json(dashboard);
        } catch (err) {
            res.status(500).json({ message: 'Failed to load dashboard' });
        }
    });

    router.post('/', async (req: Request, res: Response) => {
        const parse = CreateDashboardSchema.safeParse(req.body);
        if (!parse.success) { res.status(400).json({ message: 'Invalid body', errors: parse.error.issues }); return; }
        try {
            const { projectId, parentTaskId, ancestorTaskIds, ...rest } = parse.data;
            const projectOid = new ObjectId(projectId);

            const keyConflict = await dashboardDb.existsWithKey(projectOid, rest.key);
            if (keyConflict) {
                res.status(409).json({ message: `Dashboard key '${rest.key}' already exists in this project` });
                return;
            }

            const validation = await validateWidgets(projectOid, rest.config.widgets, dataDefDb);
            if (!validation.ok) {
                res.status(validation.status).json({ message: validation.message });
                return;
            }

            const dashboard = await dashboardDb.create({
                ...rest,
                projectId: projectOid,
                ancestorTaskIds: ancestorTaskIds.map(id => new ObjectId(id)),
                ...(parentTaskId ? { parentTaskId: new ObjectId(parentTaskId) } : {}),
            } as any);
            res.status(201).json(dashboard);
        } catch (err) {
            res.status(500).json({ message: 'Failed to create dashboard' });
        }
    });

    router.put('/:id', async (req: Request, res: Response) => {
        const parse = UpdateDashboardSchema.safeParse(req.body);
        if (!parse.success) { res.status(400).json({ message: 'Invalid body', errors: parse.error.issues }); return; }
        try {
            const existing = await dashboardDb.findById(new ObjectId(String(req.params.id)));
            if (!existing) { res.status(404).json({ message: 'Dashboard not found' }); return; }

            if (parse.data.config) {
                const validation = await validateWidgets(existing.projectId, parse.data.config.widgets, dataDefDb);
                if (!validation.ok) {
                    res.status(validation.status).json({ message: validation.message });
                    return;
                }
            }

            const updated = await dashboardDb.update({ ...existing, ...parse.data, _id: existing._id } as any);
            res.json(updated);
        } catch (err) {
            res.status(500).json({ message: 'Failed to update dashboard' });
        }
    });

    router.delete('/:id', async (req: Request, res: Response) => {
        try {
            const id = new ObjectId(String(req.params.id));
            const existing = await dashboardDb.findById(id);
            if (!existing) { res.status(404).json({ message: 'Dashboard not found' }); return; }
            await dashboardDb.delete(id);
            res.status(204).send();
        } catch (err) {
            res.status(500).json({ message: 'Failed to delete dashboard' });
        }
    });

    return router;
}
