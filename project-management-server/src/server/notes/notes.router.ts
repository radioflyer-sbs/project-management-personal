import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { NoteDbService } from '../../database/notes/note-db.service';
import { CascadeDeleteService } from '../../database/cascade-delete.service';
import { ReparentService, ReparentError } from '../../database/reparent.service';

const LayoutSchema = z.object({
    x:      z.number(),
    y:      z.number(),
    width:  z.number(),
    height: z.number(),
    zIndex: z.number(),
});

const CreateNoteSchema = z.object({
    projectId:       z.string().min(1),
    parentTaskId:    z.string().optional(),
    ancestorTaskIds: z.array(z.string()).default([]),
    title:           z.string().min(1),
    details:         z.string().default(''),
    backgroundColor: z.string().default('#fdf2c4'),
    layout:          LayoutSchema,
});

const UpdateNoteSchema = z.object({
    title:           z.string().min(1).optional(),
    details:         z.string().optional(),
    backgroundColor: z.string().optional(),
    layout:          LayoutSchema.optional(),
});

const ReparentSchema = z.object({
    newParentTaskId: z.string().min(1).nullable(),
});

export function createNoteRouter(
    noteDb: NoteDbService,
    cascadeDelete: CascadeDeleteService,
    reparent: ReparentService,
): Router {
    const router = Router();

    // Moves a note to a new parent task (or to the project root when newParentTaskId is null).
    router.put('/:id/reparent', async (req: Request, res: Response) => {
        const parse = ReparentSchema.safeParse(req.body);
        if (!parse.success) { res.status(400).json({ message: 'Invalid body', errors: parse.error.issues }); return; }
        try {
            const newParent = parse.data.newParentTaskId ? new ObjectId(parse.data.newParentTaskId) : null;
            const updated = await reparent.reparentNote(new ObjectId(String(req.params.id)), newParent);
            res.json(updated);
        } catch (err) {
            if (err instanceof ReparentError) { res.status(err.status).json({ message: err.message }); return; }
            res.status(500).json({ message: 'Failed to reparent note' });
        }
    });

    router.get('/by-project/:projectId', async (req: Request, res: Response) => {
        try {
            const notes = await noteDb.findByProject(new ObjectId(String(req.params.projectId)));
            res.json(notes);
        } catch (err) {
            res.status(500).json({ message: 'Failed to load notes' });
        }
    });

    router.get('/by-parent/:parentTaskId', async (req: Request, res: Response) => {
        try {
            const notes = await noteDb.findByParentTask(new ObjectId(String(req.params.parentTaskId)));
            res.json(notes);
        } catch (err) {
            res.status(500).json({ message: 'Failed to load notes' });
        }
    });

    router.get('/:id', async (req: Request, res: Response) => {
        try {
            const note = await noteDb.findById(new ObjectId(String(req.params.id)));
            if (!note) { res.status(404).json({ message: 'Note not found' }); return; }
            res.json(note);
        } catch (err) {
            res.status(500).json({ message: 'Failed to load note' });
        }
    });

    router.post('/', async (req: Request, res: Response) => {
        const parse = CreateNoteSchema.safeParse(req.body);
        if (!parse.success) { res.status(400).json({ message: 'Invalid body', errors: parse.error.issues }); return; }
        try {
            const { projectId, parentTaskId, ancestorTaskIds, ...rest } = parse.data;
            const note = await noteDb.create({
                ...rest,
                projectId:       new ObjectId(projectId),
                ...(parentTaskId ? { parentTaskId: new ObjectId(parentTaskId) } : {}),
                ancestorTaskIds: ancestorTaskIds.map(id => new ObjectId(id)),
            } as any);
            res.status(201).json(note);
        } catch (err) {
            res.status(500).json({ message: 'Failed to create note' });
        }
    });

    router.put('/:id', async (req: Request, res: Response) => {
        const parse = UpdateNoteSchema.safeParse(req.body);
        if (!parse.success) { res.status(400).json({ message: 'Invalid body', errors: parse.error.issues }); return; }
        try {
            const existing = await noteDb.findById(new ObjectId(String(req.params.id)));
            if (!existing) { res.status(404).json({ message: 'Note not found' }); return; }
            const updated = await noteDb.update({ ...existing, ...parse.data, _id: existing._id });
            res.json(updated);
        } catch (err) {
            res.status(500).json({ message: 'Failed to update note' });
        }
    });

    router.delete('/:id', async (req: Request, res: Response) => {
        try {
            await cascadeDelete.deleteNote(new ObjectId(String(req.params.id)));
            res.status(204).send();
        } catch (err) {
            res.status(500).json({ message: 'Failed to delete note' });
        }
    });

    return router;
}
