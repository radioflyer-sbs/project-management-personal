import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { DataDefinitionDbService } from '../../database/data-definitions/data-definition-db.service';

const DataValueTypeSchema = z.enum(['number', 'text', 'boolean', 'enum', 'timestamp', 'list']);

/** Coerce a value to the JS type that matches the definition's valueType.
 *  Guards against LLM/JSON transport coercing numbers to strings, etc. */
function coerceValue(
    value: number | string | boolean | string[] | null,
    valueType: string,
): number | string | boolean | string[] | null {
    if (value === null) { return null; }
    switch (valueType) {
        case 'number':
            return typeof value === 'number' ? value : Number(value);
        case 'boolean':
            if (typeof value === 'boolean') { return value; }
            if (value === 'true'  || value === 1) { return true;  }
            if (value === 'false' || value === 0) { return false; }
            return Boolean(value);
        case 'list':
            return Array.isArray(value) ? value : [String(value)];
        case 'text':
        case 'enum':
        case 'timestamp':
        default:
            return typeof value === 'string' ? value : String(value);
    }
}

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
                value: coerceValue(rest.value, rest.valueType),
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
            const incoming = parse.data.value !== undefined
                ? { ...parse.data, value: coerceValue(parse.data.value, existing.valueType) }
                : parse.data;
            const updated = await dataDefDb.update({ ...existing, ...incoming, _id: existing._id });
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
            const projectOid = new ObjectId(String(req.params.projectId));
            const defId      = String(req.params.id);
            const existing   = await dataDefDb.findByProjectAndId(projectOid, defId);
            if (!existing) { res.status(404).json({ message: 'Data definition not found' }); return; }
            const coerced = coerceValue(parse.data.value, existing.valueType);
            const updated = await dataDefDb.setValue(projectOid, defId, coerced);
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
