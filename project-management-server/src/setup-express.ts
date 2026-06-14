import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { Container } from 'inversify';
import { Server as SocketIOServer } from 'socket.io';
import { getAppConfig } from './config';
import { TOKENS } from './tokens';
import { ProjectDbService } from './database/projects/project-db.service';
import { TaskDbService } from './database/tasks/task-db.service';
import { NoteDbService } from './database/notes/note-db.service';
import { CascadeDeleteService } from './database/cascade-delete.service';
import { createProjectRouter } from './server/projects/projects.router';
import { createTaskRouter } from './server/tasks/tasks.router';
import { createNoteRouter } from './server/notes/notes.router';
import { createLlmRouter } from './server/llm/llm.router';
import { LlmModelDbService } from './database/llm/llm-model-db.service';
import { createGroupRouter } from './server/groups/groups.router';
import { GroupDbService } from './database/groups/group-db.service';
import { ProjectionOrderService } from './database/projection-order.service';
import { DataDefinitionDbService } from './database/data-definitions/data-definition-db.service';
import { DashboardDbService } from './database/dashboards/dashboard-db.service';
import { createDataDefinitionRouter } from './server/data-definitions/data-definitions.router';
import { createDashboardRouter } from './server/dashboards/dashboards.router';

export async function initializeExpressApp(container: Container, io: SocketIOServer): Promise<Application> {
    const config = await getAppConfig();
    const app = express();

    app.use(cors({ origin: config.corsAllowed }));
    app.use(bodyParser.json());

    // Emit data-changed after any successful content-mutating request.
    // Guards:
    //   1. Skip layout/viewState-only PUTs (drag, pan/zoom) — frequent, not content changes.
    //   2. Skip POSTs to sub-paths (/api/tasks/counts-for-ids) — read-only query actions that
    //      use POST for a body parameter. True creates always go to the collection root (/api/tasks).
    app.use((req: Request, res: Response, next: NextFunction) => {
        res.on('finish', () => {
            if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) { return; }
            if (res.statusCode >= 400) { return; }

            // Guard 1 — layout/viewState-only body
            const body = req.body;
            if (body && typeof body === 'object' && !Array.isArray(body)) {
                const keys = Object.keys(body);
                if (keys.length > 0 && keys.every(k => k === 'layout' || k === 'viewState')) { return; }
            }

            // Guard 2 — read-only POST to action sub-path (e.g. /api/tasks/counts-for-ids).
            // Use req.originalUrl (always the full original path) not req.path, which Express
            // strips to the router-relative path after the subrouter runs (e.g. /counts-for-ids).
            // True creates go to the collection root (/api/tasks = 2 segments).
            if (req.method === 'POST') {
                const fullPath = req.originalUrl.split('?')[0];
                const segments = fullPath.split('/').filter(Boolean);
                console.log(`[socket] POST ${fullPath} → segments=${segments.length} → ${segments.length > 2 ? 'SKIP' : 'EMIT'}`);
                if (segments.length > 2) { return; }
            }

            io.emit('data-changed');
        });
        next();
    });

    const projectDb      = await container.getAsync<ProjectDbService>(TOKENS.ProjectDbService);
    const taskDb         = await container.getAsync<TaskDbService>(TOKENS.TaskDbService);
    const noteDb         = await container.getAsync<NoteDbService>(TOKENS.NoteDbService);
    const cascadeDelete  = await container.getAsync<CascadeDeleteService>(TOKENS.CascadeDeleteService);
    const llmModelDb     = await container.getAsync<LlmModelDbService>(TOKENS.LlmModelDbService);
    const groupDb         = await container.getAsync<GroupDbService>(TOKENS.GroupDbService);
    const projectionOrder = await container.getAsync<ProjectionOrderService>(TOKENS.ProjectionOrderService);
    const dataDefDb       = await container.getAsync<DataDefinitionDbService>(TOKENS.DataDefinitionDbService);
    const dashboardDb     = await container.getAsync<DashboardDbService>(TOKENS.DashboardDbService);

    app.use('/api/projects',         createProjectRouter(projectDb, cascadeDelete));
    app.use('/api/tasks',            createTaskRouter(taskDb, cascadeDelete, noteDb, projectionOrder));
    app.use('/api/notes',            createNoteRouter(noteDb, cascadeDelete));
    app.use('/api/groups',           createGroupRouter(groupDb, projectionOrder));
    app.use('/api/llm',              createLlmRouter(llmModelDb));
    app.use('/api/data-definitions', createDataDefinitionRouter(dataDefDb));
    app.use('/api/dashboards',       createDashboardRouter(dashboardDb, dataDefDb));

    app.use((_req: Request, res: Response) => {
        res.status(404).json({ message: 'Not found.' });
    });

    app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
        const message = err instanceof Error ? err.message : 'Internal server error';
        console.error(`Unhandled error on ${req.method} ${req.path}:`, err);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Internal server error' });
        }
    });

    return app;
}
