import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { Container } from 'inversify';
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

export async function initializeExpressApp(container: Container): Promise<Application> {
    const config = await getAppConfig();
    const app = express();

    app.use(cors({ origin: config.corsAllowed }));
    app.use(bodyParser.json());

    const projectDb      = await container.getAsync<ProjectDbService>(TOKENS.ProjectDbService);
    const taskDb         = await container.getAsync<TaskDbService>(TOKENS.TaskDbService);
    const noteDb         = await container.getAsync<NoteDbService>(TOKENS.NoteDbService);
    const cascadeDelete  = await container.getAsync<CascadeDeleteService>(TOKENS.CascadeDeleteService);
    const llmModelDb     = await container.getAsync<LlmModelDbService>(TOKENS.LlmModelDbService);

    app.use('/api/projects', createProjectRouter(projectDb, cascadeDelete));
    app.use('/api/tasks',    createTaskRouter(taskDb, cascadeDelete, noteDb));
    app.use('/api/notes',    createNoteRouter(noteDb, cascadeDelete));
    app.use('/api/llm',      createLlmRouter(llmModelDb));

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
