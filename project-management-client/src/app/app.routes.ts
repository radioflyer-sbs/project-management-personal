import { Routes } from '@angular/router';
import { ProjectListComponent } from './components/project-list/project-list.component';
import { CanvasHostComponent } from './components/canvas-host/canvas-host.component';
import { DashboardEditorComponent } from './components/dashboard-editor/dashboard-editor.component';
import { DataMetricsComponent } from './components/data-metrics/data-metrics.component';
import { SettingsComponent } from './components/settings/settings.component';
import { LlmSettingsComponent } from './components/settings/llm-settings/llm-settings.component';
import { OllamaModelEditorComponent } from './components/settings/llm-settings/ollama-model-editor/ollama-model-editor.component';

export const routes: Routes = [
    { path: '',         redirectTo: 'projects', pathMatch: 'full' },
    { path: 'projects', component: ProjectListComponent },
    { path: 'projects/:projectId/dashboard/:dashboardId', component: DashboardEditorComponent },
    { path: 'projects/:projectId/metrics', component: DataMetricsComponent },
    { path: 'projects/:projectId', component: CanvasHostComponent },
    {
        path: 'projects/:projectId/tasks',
        children: [
            { path: '**', component: CanvasHostComponent },
        ],
    },
    {
        path: 'settings',
        component: SettingsComponent,
        children: [
            { path: '',              redirectTo: 'llm', pathMatch: 'full' },
            { path: 'llm',           component: LlmSettingsComponent },
            { path: 'llm/models/new', component: OllamaModelEditorComponent },
            { path: 'llm/models/:id', component: OllamaModelEditorComponent },
        ],
    },
    { path: '**', redirectTo: 'projects' },
];
