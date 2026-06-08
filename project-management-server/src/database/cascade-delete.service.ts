import { injectable, inject } from 'inversify';
import { ObjectId } from 'mongodb';
import { TOKENS } from '../tokens';
import { TaskDbService } from './tasks/task-db.service';
import { NoteDbService } from './notes/note-db.service';
import { ProjectDbService } from './projects/project-db.service';

/** Owns all multi-step cascade delete operations (P6, §6.3). */
@injectable()
export class CascadeDeleteService {

    constructor(
        @inject(TOKENS.ProjectDbService) private readonly projects: ProjectDbService,
        @inject(TOKENS.TaskDbService)    private readonly tasks: TaskDbService,
        @inject(TOKENS.NoteDbService)    private readonly notes: NoteDbService,
    ) { }

    /** Deletes a project and every task/note belonging to it. */
    async deleteProject(projectId: ObjectId): Promise<void> {
        await this.tasks.deleteMany({ projectId });
        await this.notes.deleteMany({ projectId });
        await this.projects.delete(projectId);
    }

    /** Deletes a task and every descendant task and note. */
    async deleteTask(taskId: ObjectId): Promise<void> {
        // Delete all descendant tasks and notes first
        await this.tasks.deleteMany({ ancestorTaskIds: taskId });
        await this.notes.deleteMany({ ancestorTaskIds: taskId });
        // Delete direct notes whose parentTaskId is this task (covers direct children
        // that may not yet have the ancestorTaskIds field, though schema guarantees they do)
        await this.notes.deleteMany({ parentTaskId: taskId });
        // Delete the task itself
        await this.tasks.delete(taskId);
    }

    /** Deletes a single note (notes have no children). */
    async deleteNote(noteId: ObjectId): Promise<void> {
        await this.notes.delete(noteId);
    }
}
