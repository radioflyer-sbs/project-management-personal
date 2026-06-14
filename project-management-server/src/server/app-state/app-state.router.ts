import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AppStateDbService } from '../../database/app-state/app-state-db.service';

export function createAppStateRouter(appStateDb: AppStateDbService): Router {
    const router = Router();

    router.get('/:key', async (req: Request, res: Response) => {
        try {
            const entry = await appStateDb.get(String(req.params['key']));
            if (!entry) { res.status(404).json({ message: 'Not found.' }); return; }
            res.json(entry);
        } catch {
            res.status(500).json({ message: 'Failed to get app state.' });
        }
    });

    router.put('/:key', async (req: Request, res: Response) => {
        const parse = z.object({ value: z.unknown() }).safeParse(req.body);
        if (!parse.success) { res.status(400).json({ message: 'Body must be { value: any }.' }); return; }
        try {
            const entry = await appStateDb.set(String(req.params['key']), parse.data.value);
            res.json(entry);
        } catch {
            res.status(500).json({ message: 'Failed to set app state.' });
        }
    });

    return router;
}
