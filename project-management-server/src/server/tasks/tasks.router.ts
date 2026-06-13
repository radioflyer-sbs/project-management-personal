import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { TaskDbService } from '../../database/tasks/task-db.service';
import { NoteDbService } from '../../database/notes/note-db.service';
import { CascadeDeleteService } from '../../database/cascade-delete.service';
import { TaskUrgency } from '../../model/shared-models/task-urgency.enum';
import { TaskCounts } from '../../model/shared-models/task-counts.model';

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
    title:           z.string().min(1).optional(),
    description:     z.string().optional(),
    urgency:         z.nativeEnum(TaskUrgency).optional(),
    isComplete:      z.boolean().optional(),
    projectToParent: z.boolean().optional(),
    layout:          LayoutSchema.optional(),
    viewState:       z.object({ panX: z.number(), panY: z.number(), zoom: z.number() }).optional(),
    groupId:         z.string().nullable().optional(),
    preGroupLayout:  LayoutSchema.nullable().optional(),
});

export function createTaskRouter(
    taskDb: TaskDbService,
    cascadeDelete: CascadeDeleteService,
    noteDb: NoteDbService,
): Router {
    const router = Router();

    router.post('/counts-for-ids', async (req: Request, res: Response) => {
        const parse = z.object({ taskIds: z.array(z.string()) }).safeParse(req.body);
        if (!parse.success) { res.status(400).json({ message: 'Invalid body' }); return; }
        try {
            const objectIds = parse.data.taskIds.map(id => new ObjectId(id));
            const [subTaskCounts, noteCounts] = await Promise.all([
                taskDb.getSubTaskCounts(objectIds),
                noteDb.getDirectNoteCountsForTasks(objectIds),
            ]);
            const result: Record<string, TaskCounts> = {};
            for (const id of parse.data.taskIds) {
                result[id] = {
                    directSubTasks: subTaskCounts.direct.get(id) ?? 0,
                    totalSubTasks:  subTaskCounts.total.get(id) ?? 0,
                    directNotes:    noteCounts.get(id) ?? 0,
                };
            }
            res.json(result);
        } catch (err) {
            res.status(500).json({ message: 'Failed to get task counts' });
        }
    });

    router.get('/by-project/:projectId', async (req: Request, res: Response) => {
        try {
            const tasks = await taskDb.findByProject(new ObjectId(String(req.params.projectId)));
            res.json(tasks);
        } catch (err) {
            res.status(500).json({ message: 'Failed to load tasks' });
        }
    });

    router.get('/by-project/:projectId/with-projections', async (req: Request, res: Response) => {
        try {
            const tasks = await taskDb.findByProjectWithProjections(new ObjectId(String(req.params.projectId)));
            res.json(tasks);
        } catch (err) {
            res.status(500).json({ message: 'Failed to load tasks with projections' });
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

    router.get('/by-parent/:parentTaskId/with-projections', async (req: Request, res: Response) => {
        try {
            const tasks = await taskDb.findByParentTaskWithProjections(new ObjectId(String(req.params.parentTaskId)));
            res.json(tasks);
        } catch (err) {
            res.status(500).json({ message: 'Failed to load tasks with projections' });
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
            const { groupId, preGroupLayout, ...rest } = parse.data;
            const merged: any = { ...existing, ...rest, _id: existing._id };
            if (groupId === null) { delete merged.groupId; delete merged.preGroupLayout; }
            else if (groupId !== undefined) { merged.groupId = groupId; }
            if (preGroupLayout === null) { delete merged.preGroupLayout; }
            else if (preGroupLayout !== undefined) { merged.preGroupLayout = preGroupLayout; }
            const updated = await taskDb.update(merged);
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
