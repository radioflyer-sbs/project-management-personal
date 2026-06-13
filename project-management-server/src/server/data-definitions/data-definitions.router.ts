import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { DataDefinitionDbService } from '../../database/data-definitions/data-definition-db.service';

const DataValueTypeSchema = z.enum(['number', 'text', 'boolean', 'enum', 'timestamp', 'list']);

const CreateDataDefinitionSchema = z.object({
    projectId: z.string().min(1),
    id:        z.string().min(1),
    label:     z.string().optional(),
    valueType: DataValueTypeSchema,
    value:     z.union([z.number(), z.string(), z.boolean(), z.array(z.string()), z.null()]),
    options:   z.object({
        unit:        z.string().optional(),
        min:         z.number().optional(),
        max:         z.number().optional(),
        enumOptions: z.array(z.string()).optional(),
    }).optional(),
});

const UpdateDataDefinitionSchema = z.object({
    label:   z.string().optional(),
    value:   z.union([z.number(), z.string(), z.boolean(), z.array(z.string()), z.null()]).optional(),
    options: z.object({
        unit:        z.string().optional(),
        min:         z.number().optional(),
        max:         z.number().optional(),
        enumOptions: z.array(z.string()).optional(),
    }).optional(),
});

const SetValueSchema = z.object({
    value: z.union([z.number(), z.string(), z.boolean(), z.array(z.string()), z.null()]),
});

export function createDataDefinitionRouter(dataDefDb: DataDefinitionDbService): Router {
    const router = Router();

    router.get('/by-project/:projectId', async (req: Request, res: Response) => {
        try {
            const defs = await dataDefDb.findByProject(new ObjectId(String(req.params.projectId)));
            res.json(defs);
        } catch (err) {
            res.status(500).json({ message: 'Failed to load data definitions' });
        }
    });

    router.get('/by-project/:projectId/id/:id', async (req: Request, res: Response) => {
        try {
            const def = await dataDefDb.findByProjectAndId(
                new ObjectId(String(req.params.projectId)),
                String(req.params.id)
            );
            if (!def) { res.status(404).json({ message: 'Data definition not found' }); return; }
            res.json(def);
        } catch (err) {
            res.status(500).json({ message: 'Failed to load data definition' });
        }
    });

    router.get('/:mongoId', async (req: Request, res: Response) => {
        try {
            const def = await dataDefDb.findByMongoId(new ObjectId(String(req.params.mongoId)));
            if (!def) { res.status(404).json({ message: 'Data definition not found' }); return; }
            res.json(def);
        } catch (err) {
            res.status(500).json({ message: 'Failed to load data definition' });
        }
    });

    router.post('/', async (req: Request, res: Response) => {
        const parse = CreateDataDefinitionSchema.safeParse(req.body);
        if (!parse.success) { res.status(400).json({ message: 'Invalid body', errors: parse.error.issues }); return; }
        try {
            const { projectId, ...rest } = parse.data;
            const projectOid = new ObjectId(projectId);
            const conflict = await dataDefDb.existsWithId(projectOid, rest.id);
            if (conflict) {
                res.status(409).json({ message: `Data definition id '${rest.id}' already exists in this project` });
                return;
            }
            const def = await dataDefDb.create({
                ...rest,
                projectId: projectOid,
            } as any);
            res.status(201).json(def);
        } catch (err) {
            res.status(500).json({ message: 'Failed to create data definition' });
        }
    });

    router.put('/:mongoId', async (req: Request, res: Response) => {
        const parse = UpdateDataDefinitionSchema.safeParse(req.body);
        if (!parse.success) { res.status(400).json({ message: 'Invalid body', errors: parse.error.issues }); return; }
        try {
            const existing = await dataDefDb.findByMongoId(new ObjectId(String(req.params.mongoId)));
            if (!existing) { res.status(404).json({ message: 'Data definition not found' }); return; }
            const updated = await dataDefDb.update({ ...existing, ...parse.data, _id: existing._id });
            res.json(updated);
        } catch (err) {
            res.status(500).json({ message: 'Failed to update data definition' });
        }
    });

    /** Hot path: set a metric value by (projectId, id). */
    router.post('/by-project/:projectId/id/:id/value', async (req: Request, res: Response) => {
        const parse = SetValueSchema.safeParse(req.body);
        if (!parse.success) { res.status(400).json({ message: 'Invalid body', errors: parse.error.issues }); return; }
        try {
            const updated = await dataDefDb.setValue(
                new ObjectId(String(req.params.projectId)),
                String(req.params.id),
                parse.data.value
            );
            if (!updated) { res.status(404).json({ message: 'Data definition not found' }); return; }
            res.json(updated);
        } catch (err) {
            res.status(500).json({ message: 'Failed to set value' });
        }
    });

    router.delete('/:mongoId', async (req: Request, res: Response) => {
        try {
            const id = new ObjectId(String(req.params.mongoId));
            const existing = await dataDefDb.findByMongoId(id);
            if (!existing) { res.status(404).json({ message: 'Data definition not found' }); return; }
            await dataDefDb.delete(id);
            res.status(204).send();
        } catch (err) {
            res.status(500).json({ message: 'Failed to delete data definition' });
        }
    });

    return router;
}
