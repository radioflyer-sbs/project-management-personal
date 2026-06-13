import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientBase } from './api-client-base.service';
import { Dashboard, DashboardConfig } from '../../../model/shared-models/dashboard.model';
import { Layout } from '../../../model/shared-models/layout.model';

export interface CreateDashboardDto {
    projectId: string;
    parentTaskId?: string;
    ancestorTaskIds: string[];
    layout: Layout;
    title: string;
    key: string;
    config: DashboardConfig;
}

export type UpdateDashboardDto = Partial<Pick<Dashboard, 'title' | 'layout'> & { config: DashboardConfig }>;

@Injectable({ providedIn: 'root' })
export class DashboardApiClient extends ApiClientBase {

    constructor() { super(); }

    getByProject(projectId: string): Observable<Dashboard[]> {
        return this.http.get<Dashboard[]>(
            `${this.apiBaseUrl}/dashboards/by-project/${projectId}`,
            this.buildOptions().build()
        );
    }

    getByParentTask(parentTaskId: string): Observable<Dashboard[]> {
        return this.http.get<Dashboard[]>(
            `${this.apiBaseUrl}/dashboards/by-parent/${parentTaskId}`,
            this.buildOptions().build()
        );
    }

    getByProjectAndKey(projectId: string, key: string): Observable<Dashboard> {
        return this.http.get<Dashboard>(
            `${this.apiBaseUrl}/dashboards/by-project/${projectId}/key/${key}`,
            this.buildOptions().build()
        );
    }

    getById(id: string): Observable<Dashboard> {
        return this.http.get<Dashboard>(
            `${this.apiBaseUrl}/dashboards/${id}`,
            this.buildOptions().build()
        );
    }

    create(data: CreateDashboardDto): Observable<Dashboard> {
        return this.http.post<Dashboard>(
            `${this.apiBaseUrl}/dashboards`,
            data,
            this.buildOptions().build()
        );
    }

    update(id: string, data: UpdateDashboardDto): Observable<Dashboard> {
        return this.http.put<Dashboard>(
            `${this.apiBaseUrl}/dashboards/${id}`,
            data,
            this.buildOptions().build()
        );
    }

    delete(id: string): Observable<void> {
        return this.http.delete<void>(
            `${this.apiBaseUrl}/dashboards/${id}`,
            this.buildOptions().build()
        );
    }
}
