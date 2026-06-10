import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientBase } from './api-client-base.service';
import { Group } from '../../../model/shared-models/group.model';
import { Layout } from '../../../model/shared-models/layout.model';

export interface CreateGroupDto {
    projectId: string;
    parentTaskId?: string;
    title: string;
    layout: Layout;
    itemIds: string[];
}

@Injectable({ providedIn: 'root' })
export class GroupApiClient extends ApiClientBase {

    constructor() { super(); }

    getByProject(projectId: string): Observable<Group[]> {
        return this.http.get<Group[]>(`${this.apiBaseUrl}/groups/by-project/${projectId}`, this.buildOptions().build());
    }

    getByParentTask(parentTaskId: string): Observable<Group[]> {
        return this.http.get<Group[]>(`${this.apiBaseUrl}/groups/by-parent/${parentTaskId}`, this.buildOptions().build());
    }

    getById(id: string): Observable<Group> {
        return this.http.get<Group>(`${this.apiBaseUrl}/groups/${id}`, this.buildOptions().build());
    }

    create(data: CreateGroupDto): Observable<Group> {
        return this.http.post<Group>(`${this.apiBaseUrl}/groups`, data, this.buildOptions().build());
    }

    update(id: string, data: Partial<{ title: string; layout: Layout; itemIds: string[] }>): Observable<Group> {
        return this.http.put<Group>(`${this.apiBaseUrl}/groups/${id}`, data, this.buildOptions().build());
    }

    delete(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiBaseUrl}/groups/${id}`, this.buildOptions().build());
    }
}
