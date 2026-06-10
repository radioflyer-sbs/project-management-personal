import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientBase } from './api-client-base.service';
import { Task } from '../../../model/shared-models/task.model';
import { Layout } from '../../../model/shared-models/layout.model';
import { TaskUrgency } from '../../../model/shared-models/task-urgency.enum';
import { CanvasViewState } from '../../../model/shared-models/canvas-view-state.model';
import { TaskCounts } from '../../../model/shared-models/task-counts.model';

export interface CreateTaskDto {
    projectId: string;
    parentTaskId?: string;
    ancestorTaskIds: string[];
    title: string;
    description: string;
    urgency: TaskUrgency;
    isComplete: boolean;
    layout: Layout;
}

@Injectable({ providedIn: 'root' })
export class TaskApiClient extends ApiClientBase {

    constructor() { super(); }

    getById(id: string): Observable<Task> {
        return this.http.get<Task>(`${this.apiBaseUrl}/tasks/${id}`, this.buildOptions().build());
    }

    getByProject(projectId: string): Observable<Task[]> {
        return this.http.get<Task[]>(`${this.apiBaseUrl}/tasks/by-project/${projectId}`, this.buildOptions().build());
    }

    getByParentTask(parentTaskId: string): Observable<Task[]> {
        return this.http.get<Task[]>(`${this.apiBaseUrl}/tasks/by-parent/${parentTaskId}`, this.buildOptions().build());
    }

    create(data: CreateTaskDto): Observable<Task> {
        return this.http.post<Task>(`${this.apiBaseUrl}/tasks`, data, this.buildOptions().build());
    }

    update(id: string, data: Partial<{ title: string; description: string; urgency: TaskUrgency; isComplete: boolean; layout: Layout; viewState: CanvasViewState; groupId: string | null; preGroupLayout: Layout | null }>): Observable<Task> {
        return this.http.put<Task>(`${this.apiBaseUrl}/tasks/${id}`, data, this.buildOptions().build());
    }

    delete(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiBaseUrl}/tasks/${id}`, this.buildOptions().build());
    }

    getCounts(taskIds: string[]): Observable<Record<string, TaskCounts>> {
        return this.http.post<Record<string, TaskCounts>>(
            `${this.apiBaseUrl}/tasks/counts-for-ids`,
            { taskIds },
            this.buildOptions().build(),
        );
    }
}
