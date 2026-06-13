import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { GroupDbService } from '../../database/groups/group-db.service';
import { ProjectionOrderService } from '../../database/projection-order.service';

const LayoutSchema = z.object({
    x:      z.number(),
    y:      z.number(),
    width:  z.number(),
    height: z.number(),
    zIndex: z.number(),
});

const CreateGroupSchema = z.object({
    projectId:       z.string().min(1),
    parentTaskId:    z.string().optional(),
    title:           z.string().default('Group'),
    layout:          LayoutSchema,
    itemIds:         z.array(z.string()).default([]),
    layoutDirection: z.enum(['vertical', 'horizontal']).default('vertical'),
    layoutWrap:      z.boolean().default(false),
});

const UpdateGroupSchema = z.object({
    title:           z.string().min(1).optional(),
    layout:          LayoutSchema.optional(),
    itemIds:         z.array(z.string()).optional(),
    layoutDirection: z.enum(['vertical', 'horizontal']).optional(),
    layoutWrap:      z.boolean().optional(),
});

export function createGroupRouter(
    groupDb: GroupDbService,
    projectionOrder: ProjectionOrderService,
): Router {
    const router = Router();

    router.get('/by-project/:projectId', async (req: Request, res: Response) => {
        try {
            const groups = await groupDb.findByProject(new ObjectId(String(req.params.projectId)));
            res.json(groups);
        } catch (err) {
            res.status(500).json({ message: 'Failed to load groups' });
        }
    });

    router.get('/by-parent/:parentTaskId', async (req: Request, res: Response) => {
        try {
            const groups = await groupDb.findByParentTask(new ObjectId(String(req.params.parentTaskId)));
            res.json(groups);
        } catch (err) {
            res.status(500).json({ message: 'Failed to load groups' });
        }
    });

    router.get('/:id', async (req: Request, res: Response) => {
        try {
            const group = await groupDb.findById(new ObjectId(String(req.params.id)));
            if (!group) { res.status(404).json({ message: 'Group not found' }); return; }
            res.json(group);
        } catch (err) {
            res.status(500).json({ message: 'Failed to load group' });
        }
    });

    router.post('/', async (req: Request, res: Response) => {
        const parse = CreateGroupSchema.safeParse(req.body);
        if (!parse.success) { res.status(400).json({ message: 'Invalid body', errors: parse.error.issues }); return; }
        try {
            const { projectId, parentTaskId, ...rest } = parse.data;
            const group = await groupDb.create({
                ...rest,
                projectId: new ObjectId(projectId),
                ...(parentTaskId ? { parentTaskId: new ObjectId(parentTaskId) } : {}),
            } as any);
            projectionOrder.scheduleRecompute(group.parentTaskId);
            res.status(201).json(group);
        } catch (err) {
            res.status(500).json({ message: 'Failed to create group' });
        }
    });

    router.put('/:id', async (req: Request, res: Response) => {
        const parse = UpdateGroupSchema.safeParse(req.body);
        if (!parse.success) { res.status(400).json({ message: 'Invalid body', errors: parse.error.issues }); return; }
        try {
            const existing = await groupDb.findById(new ObjectId(String(req.params.id)));
            if (!existing) { res.status(404).json({ message: 'Group not found' }); return; }
            const updated = await groupDb.update({ ...existing, ...parse.data, _id: existing._id });
            // Box size, membership, and layout direction all affect reading order.
            if (parse.data.layout !== undefined || parse.data.itemIds !== undefined
                || parse.data.layoutDirection !== undefined || parse.data.layoutWrap !== undefined) {
                projectionOrder.scheduleRecompute(updated.parentTaskId);
            }
            res.json(updated);
        } catch (err) {
            res.status(500).json({ message: 'Failed to update group' });
        }
    });

    router.delete('/:id', async (req: Request, res: Response) => {
        try {
            const id = new ObjectId(String(req.params.id));
            const existing = await groupDb.findById(id);
            await groupDb.delete(id);
            projectionOrder.scheduleRecompute(existing?.parentTaskId);
            res.status(204).send();
        } catch (err) {
            res.status(500).json({ message: 'Failed to delete group' });
        }
    });

    return router;
}
