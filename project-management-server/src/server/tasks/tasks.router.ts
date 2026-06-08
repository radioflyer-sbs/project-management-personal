import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { TaskDbService } from '../../database/tasks/task-db.service';
import { CascadeDeleteService } from '../../database/cascade-delete.service';
import { TaskUrgency } from '../../model/shared-models/task-urgency.enum';

const LayoutSchema = z.object({
    x:      z.number(),
    y:      z.number(),
    width:  z.number(),
    height: z.number(),
    zIndex: z.number(),
});

const CreateTaskSchema = z.object({
    projectId:       z.string().min(1),
    parentTaskId:    z.string().optional(),
    ancestorTaskIds: z.array(z.string()).default([]),
    title:           z.string().min(1),
    description:     z.string().default(''),
    urgency:         z.nativeEnum(TaskUrgency).default(TaskUrgency.Normal),
    isComplete:      z.boolean().default(false),
    layout:          LayoutSchema,
});

const UpdateTaskSchema = z.object({
    title:       z.string().min(1).optional(),
    description: z.string().optional(),
    urgency:     z.nativeEnum(TaskUrgency).optional(),
    isComplete:  z.boolean().optional(),
    layout:      LayoutSchema.optional(),
    viewState:   z.object({ panX: z.number(), panY: z.number(), zoom: z.number() }).optional(),
});

export function createTaskRouter(
    taskDb: TaskDbService,
    cascadeDelete: CascadeDeleteService,
): Router {
    const router = Router();

    router.get('/by-project/:projectId', async (req: Request, res: Response) => {
        try {
            const tasks = await taskDb.findByProject(new ObjectId(String(req.params.projectId)));
            res.json(tasks);
        } catch (err) {
            res.status(500).json({ message: 'Failed to load tasks' });
        }
    });

    router.get('/by-parent/:parentTaskId', async (req: Request, res: Response) => {
        try {
            const tasks = await taskDb.findByParentTask(new ObjectId(String(req.params.parentTaskId)));
            res.json(tasks);
        } catch (err) {
            res.status(500).json({ message: 'Failed to load tasks' });
        }
    });

    router.get('/:id', async (req: Request, res: Response) => {
        try {
            const task = await taskDb.findById(new ObjectId(String(req.params.id)));
            if (!task) { res.status(404).json({ message: 'Task not found' }); return; }
            res.json(task);
        } catch (err) {
            res.status(500).json({ message: 'Failed to load task' });
        }
    });

    router.post('/', async (req: Request, res: Response) => {
        const parse = CreateTaskSchema.safeParse(req.body);
        if (!parse.success) { res.status(400).json({ message: 'Invalid body', errors: parse.error.issues }); return; }
        try {
            const { projectId, parentTaskId, ancestorTaskIds, ...rest } = parse.data;
            const task = await taskDb.create({
                ...rest,
                projectId:       new ObjectId(projectId),
                ...(parentTaskId ? { parentTaskId: new ObjectId(parentTaskId) } : {}),
                ancestorTaskIds: ancestorTaskIds.map(id => new ObjectId(id)),
            } as any);
            res.status(201).json(task);
        } catch (err) {
            res.status(500).json({ message: 'Failed to create task' });
        }
    });

    router.put('/:id', async (req: Request, res: Response) => {
        const parse = UpdateTaskSchema.safeParse(req.body);
        if (!parse.success) { res.status(400).json({ message: 'Invalid body', errors: parse.error.issues }); return; }
        try {
            const existing = await taskDb.findById(new ObjectId(String(req.params.id)));
            if (!existing) { res.status(404).json({ message: 'Task not found' }); return; }
            const updated = await taskDb.update({ ...existing, ...parse.data, _id: existing._id });
            res.json(updated);
        } catch (err) {
            res.status(500).json({ message: 'Failed to update task' });
        }
    });

    router.delete('/:id', async (req: Request, res: Response) => {
        try {
            await cascadeDelete.deleteTask(new ObjectId(String(req.params.id)));
            res.status(204).send();
        } catch (err) {
            res.status(500).json({ message: 'Failed to delete task' });
        }
    });

    return router;
}
