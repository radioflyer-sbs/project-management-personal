import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { ProjectDbService } from '../../database/projects/project-db.service';
import { CascadeDeleteService } from '../../database/cascade-delete.service';

const CreateProjectSchema = z.object({
    name:        z.string().min(1),
    description: z.string().default(''),
});

const UpdateProjectSchema = z.object({
    name:        z.string().min(1).optional(),
    description: z.string().optional(),
    viewState:   z.object({ panX: z.number(), panY: z.number(), zoom: z.number() }).optional(),
});

export function createProjectRouter(
    projectDb: ProjectDbService,
    cascadeDelete: CascadeDeleteService,
): Router {
    const router = Router();

    router.get('/', async (_req: Request, res: Response) => {
        try {
            const projects = await projectDb.findAll();
            res.json(projects);
        } catch (err) {
            res.status(500).json({ message: 'Failed to load projects' });
        }
    });

    router.get('/:id', async (req: Request, res: Response) => {
        try {
            const project = await projectDb.findById(new ObjectId(String(req.params.id)));
            if (!project) { res.status(404).json({ message: 'Project not found' }); return; }
            res.json(project);
        } catch (err) {
            res.status(500).json({ message: 'Failed to load project' });
        }
    });

    router.post('/', async (req: Request, res: Response) => {
        const parse = CreateProjectSchema.safeParse(req.body);
        if (!parse.success) { res.status(400).json({ message: 'Invalid body', errors: parse.error.issues }); return; }
        try {
            const project = await projectDb.create(parse.data as any);
            res.status(201).json(project);
        } catch (err) {
            res.status(500).json({ message: 'Failed to create project' });
        }
    });

    router.put('/:id', async (req: Request, res: Response) => {
        const parse = UpdateProjectSchema.safeParse(req.body);
        if (!parse.success) { res.status(400).json({ message: 'Invalid body', errors: parse.error.issues }); return; }
        try {
            const existing = await projectDb.findById(new ObjectId(String(req.params.id)));
            if (!existing) { res.status(404).json({ message: 'Project not found' }); return; }
            const updated = await projectDb.update({ ...existing, ...parse.data, _id: existing._id });
            res.json(updated);
        } catch (err) {
            res.status(500).json({ message: 'Failed to update project' });
        }
    });

    router.delete('/:id', async (req: Request, res: Response) => {
        try {
            await cascadeDelete.deleteProject(new ObjectId(String(req.params.id)));
            res.status(204).send();
        } catch (err) {
            res.status(500).json({ message: 'Failed to delete project' });
        }
    });

    return router;
}
