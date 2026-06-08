import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Location } from '@angular/common';
import { BehaviorSubject, Observable, filter, map } from 'rxjs';

export interface BreadcrumbSegment {
    label: string;
    url: string;
}

@Injectable({ providedIn: 'root' })
export class NavigationService {

    constructor() {
        this.router.events.pipe(
            filter(e => e instanceof NavigationEnd)
        ).subscribe(() => this.parseCurrentUrl());
    }

    private readonly router   = inject(Router);
    private readonly location = inject(Location);

    private readonly taskIds$ = new BehaviorSubject<string[]>([]);
    private readonly projectId$ = new BehaviorSubject<string | null>(null);

    readonly currentProjectId$: Observable<string | null> = this.projectId$.asObservable();
    readonly currentTaskIds$: Observable<string[]> = this.taskIds$.asObservable();

    get currentProjectId(): string | null { return this.projectId$.getValue(); }
    get currentTaskIds(): string[] { return this.taskIds$.getValue(); }

    get currentTaskId(): string | null {
        const ids = this.taskIds$.getValue();
        return ids.length > 0 ? ids[ids.length - 1] : null;
    }

    get isOnTaskCanvas(): boolean { return this.currentTaskId !== null; }

    parseCurrentUrl(): void {
        const url = this.location.path();
        const projectMatch = url.match(/\/projects\/([^/]+)/);
        const projectId = projectMatch ? projectMatch[1] : null;
        this.projectId$.next(projectId);

        const taskSplit = url.split('/tasks/');
        if (taskSplit.length > 1) {
            const taskIds = taskSplit[1].split('/').filter(Boolean);
            this.taskIds$.next(taskIds);
        } else {
            this.taskIds$.next([]);
        }
    }

    navigateToProjects(): void {
        this.router.navigate(['/projects']);
    }

    navigateToProject(projectId: string): void {
        this.router.navigate(['/projects', projectId]);
    }

    drillIntoTask(projectId: string, taskIdChain: string[]): void {
        this.router.navigate(['/projects', projectId, 'tasks', ...taskIdChain]);
    }

    navigateToParent(): void {
        const projectId = this.currentProjectId;
        const taskIds = this.currentTaskIds;

        if (!projectId) { return; }

        if (taskIds.length <= 1) {
            this.navigateToProject(projectId);
        } else {
            this.drillIntoTask(projectId, taskIds.slice(0, -1));
        }
    }
}
