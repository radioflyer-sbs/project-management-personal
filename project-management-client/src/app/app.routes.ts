import { Routes } from '@angular/router';
import { ProjectListComponent } from './components/project-list/project-list.component';
import { CanvasHostComponent } from './components/canvas-host/canvas-host.component';

export const routes: Routes = [
    { path: '',         redirectTo: 'projects', pathMatch: 'full' },
    { path: 'projects', component: ProjectListComponent },
    { path: 'projects/:projectId', component: CanvasHostComponent },
    {
        path: 'projects/:projectId/tasks',
        children: [
            { path: '**', component: CanvasHostComponent },
        ],
    },
    { path: '**', redirectTo: 'projects' },
];
