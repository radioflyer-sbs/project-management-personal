import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientBase } from './api-client-base.service';
import { Project } from '../../../model/shared-models/project.model';
import { CanvasViewState } from '../../../model/shared-models/canvas-view-state.model';

@Injectable({ providedIn: 'root' })
export class ProjectApiClient extends ApiClientBase {

    constructor() { super(); }

    getAll(): Observable<Project[]> {
        return this.http.get<Project[]>(`${this.apiBaseUrl}/projects`, this.buildOptions().build());
    }

    getById(id: string): Observable<Project> {
        return this.http.get<Project>(`${this.apiBaseUrl}/projects/${id}`, this.buildOptions().build());
    }

    create(data: { name: string; description: string }): Observable<Project> {
        return this.http.post<Project>(`${this.apiBaseUrl}/projects`, data, this.buildOptions().build());
    }

    update(id: string, data: Partial<{ name: string; description: string; viewState: CanvasViewState }>): Observable<Project> {
        return this.http.put<Project>(`${this.apiBaseUrl}/projects/${id}`, data, this.buildOptions().build());
    }

    delete(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiBaseUrl}/projects/${id}`, this.buildOptions().build());
    }
}
