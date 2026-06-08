import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientBase } from './api-client-base.service';
import { Note } from '../../../model/shared-models/note.model';
import { Layout } from '../../../model/shared-models/layout.model';

export interface CreateNoteDto {
    projectId: string;
    parentTaskId?: string;
    ancestorTaskIds: string[];
    title: string;
    details: string;
    backgroundColor: string;
    layout: Layout;
}

@Injectable({ providedIn: 'root' })
export class NoteApiClient extends ApiClientBase {

    constructor() { super(); }

    getById(id: string): Observable<Note> {
        return this.http.get<Note>(`${this.apiBaseUrl}/notes/${id}`, this.buildOptions().build());
    }

    getByProject(projectId: string): Observable<Note[]> {
        return this.http.get<Note[]>(`${this.apiBaseUrl}/notes/by-project/${projectId}`, this.buildOptions().build());
    }

    getByParentTask(parentTaskId: string): Observable<Note[]> {
        return this.http.get<Note[]>(`${this.apiBaseUrl}/notes/by-parent/${parentTaskId}`, this.buildOptions().build());
    }

    create(data: CreateNoteDto): Observable<Note> {
        return this.http.post<Note>(`${this.apiBaseUrl}/notes`, data, this.buildOptions().build());
    }

    update(id: string, data: Partial<{ title: string; details: string; backgroundColor: string; layout: Layout }>): Observable<Note> {
        return this.http.put<Note>(`${this.apiBaseUrl}/notes/${id}`, data, this.buildOptions().build());
    }

    delete(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiBaseUrl}/notes/${id}`, this.buildOptions().build());
    }
}
