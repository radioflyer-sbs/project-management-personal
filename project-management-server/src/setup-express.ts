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
import { ReparentService } from './database/reparent.service';
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
import { createAppStateRouter } from './server/app-state/app-state.router';
import { AppStateDbService } from './database/app-state/app-state-db.service';

export async function initializeExpressApp(container: Container, io: SocketIOServer): Promise<Application> {
    const config = await getAppConfig();
    const app = express();

    app.use(cors({ origin: config.corsAllowed }));
    app.use(bodyParser.json());

    // Emit data-changed after any successful content-mutating request.
    // Guards:
    //   1. Skip layout/viewState-only PUTs (drag, pan/zoom) — frequent, not content changes.
    //   2. Skip known read-only action POSTs (e.g. counts-for-ids) — query operations that use
    //      POST only because they need a request body. Listed explicitly in READ_ONLY_POST_PATHS.
    //   2b. Skip app-state writes — internal UI tracking, not content the canvas needs to reload.
    app.use((req: Request, res: Response, next: NextFunction) => {
        res.on('finish', () => {
            if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) { return; }
            if (res.statusCode >= 400) { return; }

            // Guard 1 — layout/viewState-only body (skip for MCP requests, which always want a refresh)
            const isMcp = req.headers['x-source'] === 'mcp';
            if (!isMcp) {
                const body = req.body;
                if (body && typeof body === 'object' && !Array.isArray(body)) {
                    const keys = Object.keys(body);
                    if (keys.length > 0 && keys.every(k => k === 'layout' || k === 'viewState')) { return; }
                }
            }

            // Guard 2b — internal app-state writes are UI tracking only, not content changes.
            if (req.originalUrl.startsWith('/api/app-state/')) { return; }

            // Guard 2 — suppress known read-only action POSTs that use a request body for
            // parameters (they are query operations, not mutations).
            // Listed explicitly because the old segment-count heuristic incorrectly suppressed
            // write paths like POST /api/data-definitions/by-project/:id/id/:id/value.
            const READ_ONLY_POST_PATHS = [
                '/api/tasks/counts-for-ids',
            ];
            if (req.method === 'POST') {
                const fullPath = req.originalUrl.split('?')[0];
                if (READ_ONLY_POST_PATHS.includes(fullPath)) { return; }
            }

            io.emit('data-changed');
        });
        next();
    });

    const projectDb      = await container.getAsync<ProjectDbService>(TOKENS.ProjectDbService);
    const taskDb         = await container.getAsync<TaskDbService>(TOKENS.TaskDbService);
    const noteDb         = await container.getAsync<NoteDbService>(TOKENS.NoteDbService);
    const cascadeDelete  = await container.getAsync<CascadeDeleteService>(TOKENS.CascadeDeleteService);
    const reparent       = await container.getAsync<ReparentService>(TOKENS.ReparentService);
    const llmModelDb     = await container.getAsync<LlmModelDbService>(TOKENS.LlmModelDbService);
    const groupDb         = await container.getAsync<GroupDbService>(TOKENS.GroupDbService);
    const projectionOrder = await container.getAsync<ProjectionOrderService>(TOKENS.ProjectionOrderService);
    const dataDefDb       = await container.getAsync<DataDefinitionDbService>(TOKENS.DataDefinitionDbService);
    const dashboardDb     = await container.getAsync<DashboardDbService>(TOKENS.DashboardDbService);
    const appStateDb      = await container.getAsync<AppStateDbService>(TOKENS.AppStateDbService);

    app.use('/api/projects',         createProjectRouter(projectDb, cascadeDelete));
    app.use('/api/tasks',            createTaskRouter(taskDb, cascadeDelete, noteDb, projectionOrder, reparent));
    app.use('/api/notes',            createNoteRouter(noteDb, cascadeDelete, reparent));
    app.use('/api/groups',           createGroupRouter(groupDb, taskDb, projectionOrder, reparent));
    app.use('/api/llm',              createLlmRouter(llmModelDb));
    app.use('/api/data-definitions', createDataDefinitionRouter(dataDefDb));
    app.use('/api/dashboards',       createDashboardRouter(dashboardDb, dataDefDb, reparent));
    app.use('/api/app-state',        createAppStateRouter(appStateDb));

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
