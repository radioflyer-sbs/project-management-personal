import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { Container } from 'inversify';
import { getAppConfig } from './config';

/** Wires up Express middleware and routes, returns the configured Application. */
export async function initializeExpressApp(container: Container): Promise<Application> {
    const config = await getAppConfig();
    const app = express();

    // CORS — allow only the configured origins.
    app.use(cors({ origin: config.corsAllowed }));

    // Body parsing.
    app.use(bodyParser.json());

    // TODO-Immediate: Resolve services from container and mount routers here.
    // Example:
    // const projectDbService = await container.getAsync(TOKENS.ProjectDbService);
    // app.use('/api', createProjectRouter(projectDbService));

    // 404 fallback.
    app.use((_req: Request, res: Response) => {
        res.status(404).json({ message: 'Not found.' });
    });

    // Global error handler — must have 4 args for Express to recognize it.
    app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
        const message = err instanceof Error ? err.message : 'Internal server error';
        console.error(`Unhandled error on ${req.method} ${req.path}:`, err);

        if (!res.headersSent) {
            res.status(500).json({ message: 'Internal server error' });
        }
    });

    return app;
}
