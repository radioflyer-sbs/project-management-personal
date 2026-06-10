import { Injectable, inject } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ProjectApiClient } from './api-clients/project-api.client';
import { TaskApiClient } from './api-clients/task-api.client';
import { NoteApiClient } from './api-clients/note-api.client';
import { GroupApiClient } from './api-clients/group-api.client';
import { SelectionService } from './selection.service';

/** Single entry point for all destructive actions (P6). Always shows a confirmation dialog. */
@Injectable({ providedIn: 'root' })
export class DeletionService {

    constructor() { }

    private readonly confirmation = inject(ConfirmationService);
    private readonly projectApi   = inject(ProjectApiClient);
    private readonly taskApi      = inject(TaskApiClient);
    private readonly noteApi      = inject(NoteApiClient);
    private readonly groupApi     = inject(GroupApiClient);
    private readonly selection    = inject(SelectionService);

    deleteProject(id: string, name: string, onSuccess: () => void): void {
        this.confirmation.confirm({
            header:  'Delete Project',
            message: `Delete "${name}" and all its tasks and notes? This cannot be undone.`,
            icon:    'pi pi-exclamation-triangle',
            accept:  () => {
                this.projectApi.delete(id).subscribe(() => {
                    this.selection.clear();
                    onSuccess();
                });
            },
        });
    }

    deleteTask(id: string, title: string, onSuccess: () => void): void {
        this.confirmation.confirm({
            header:  'Delete Task',
            message: `Delete "${title}" and all its children? This cannot be undone.`,
            icon:    'pi pi-exclamation-triangle',
            accept:  () => {
                this.taskApi.delete(id).subscribe(() => {
                    this.selection.clear();
                    onSuccess();
                });
            },
        });
    }

    deleteGroup(id: string, title: string, onSuccess: () => void): void {
        this.confirmation.confirm({
            header:  'Delete Group',
            message: `Delete "${title}"? Contained tasks will be released back to the canvas.`,
            icon:    'pi pi-exclamation-triangle',
            accept:  () => {
                this.groupApi.delete(id).subscribe(() => {
                    this.selection.clear();
                    onSuccess();
                });
            },
        });
    }

    deleteNote(id: string, title: string, onSuccess: () => void): void {
        this.confirmation.confirm({
            header:  'Delete Note',
            message: `Delete "${title}"? This cannot be undone.`,
            icon:    'pi pi-exclamation-triangle',
            accept:  () => {
                this.noteApi.delete(id).subscribe(() => {
                    this.selection.clear();
                    onSuccess();
                });
            },
        });
    }
}
