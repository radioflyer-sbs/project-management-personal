import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter, switchMap, catchError, of } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { MenuItem } from 'primeng/api';
import { ComponentBase } from '../component-base/component-base.component';
import { NavigationService } from '../../services/navigation.service';
import { ProjectsService } from '../../services/projects.service';
import { TaskApiClient } from '../../services/api-clients/task-api.client';

@Component({
    selector: 'app-shell',
    standalone: true,
    imports: [CommonModule, RouterModule, BreadcrumbModule],
    templateUrl: './app-shell.component.html',
    styleUrl: './app-shell.component.scss',
})
export class AppShellComponent extends ComponentBase implements OnInit {

    constructor() { super(); }

    private readonly router      = inject(Router);
    private readonly navigation  = inject(NavigationService);
    private readonly projects    = inject(ProjectsService);
    private readonly taskApi     = inject(TaskApiClient);

    breadcrumbs: MenuItem[] = [];

    ngOnInit(): void {
        this.router.events.pipe(
            filter(e => e instanceof NavigationEnd),
            takeUntil(this.ngDestroy$),
        ).subscribe(() => this.buildBreadcrumb());

        this.buildBreadcrumb();
    }

    private buildBreadcrumb(): void {
        const projectId = this.navigation.currentProjectId;
        const taskIds   = this.navigation.currentTaskIds;

        const items: MenuItem[] = [
            { label: 'Projects', routerLink: ['/projects'] },
        ];

        if (!projectId) {
            this.breadcrumbs = items;
            return;
        }

        this.projects.getById(projectId).pipe(
            switchMap(project => {
                items.push({ label: project.name, routerLink: ['/projects', projectId] });

                if (taskIds.length === 0) {
                    this.breadcrumbs = items;
                    return of(null);
                }

                // Fetch task names for each id in the chain
                const chain$ = taskIds.reduce((acc$, taskId, index) => {
                    return acc$.pipe(
                        switchMap(chain => {
                            return this.taskApi.getById(taskId).pipe(
                                catchError(() => of(null)),
                            );
                        }),
                    );
                }, of<any>(null));

                return chain$;
            }),
            catchError(() => of(null)),
            takeUntil(this.ngDestroy$),
        ).subscribe(() => {
            // Build task breadcrumbs synchronously from task ids
            // (the forkJoin approach below is cleaner)
        });

        // Simpler direct approach: rebuild from route URL
        if (projectId) {
            this.projects.getById(projectId).pipe(
                catchError(() => of(null)),
                takeUntil(this.ngDestroy$),
            ).subscribe(project => {
                if (!project) { return; }
                const crumbs: MenuItem[] = [
                    { label: 'Projects', routerLink: ['/projects'] },
                    { label: project.name, routerLink: ['/projects', projectId] },
                ];

                if (taskIds.length > 0) {
                    taskIds.forEach((taskId, i) => {
                        const chain = taskIds.slice(0, i + 1);
                        crumbs.push({
                            label: `Task…`,
                            routerLink: ['/projects', projectId, 'tasks', ...chain],
                        });
                    });

                    // Resolve task names
                    taskIds.forEach((taskId, i) => {
                        this.taskApi.getById(taskId).pipe(
                            catchError(() => of(null)),
                            takeUntil(this.ngDestroy$),
                        ).subscribe(task => {
                            if (task && crumbs[i + 2]) {
                                crumbs[i + 2] = {
                                    ...crumbs[i + 2],
                                    label: task.title,
                                };
                                this.breadcrumbs = [...crumbs];
                            }
                        });
                    });
                }

                this.breadcrumbs = crumbs;
            });
        }
    }
}
