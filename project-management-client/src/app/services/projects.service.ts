import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, switchMap } from 'rxjs';
import { ProjectApiClient } from './api-clients/project-api.client';
import { Project } from '../../model/shared-models/project.model';
import { CanvasViewState } from '../../model/shared-models/canvas-view-state.model';

@Injectable({ providedIn: 'root' })
export class ProjectsService {

    constructor() { }

    private readonly api = inject(ProjectApiClient);
    private readonly reloadTrigger$ = new BehaviorSubject<void>(undefined);

    readonly projects$: Observable<Project[]> = this.reloadTrigger$.pipe(
        switchMap(() => this.api.getAll())
    );

    reload(): void {
        this.reloadTrigger$.next();
    }

    getById(id: string): Observable<Project> {
        return this.api.getById(id);
    }

    create(name: string, description: string): Observable<Project> {
        return this.api.create({ name, description });
    }

    update(id: string, data: Partial<{ name: string; description: string; viewState: CanvasViewState }>): Observable<Project> {
        return this.api.update(id, data);
    }

    delete(id: string): Observable<void> {
        return this.api.delete(id);
    }
}
