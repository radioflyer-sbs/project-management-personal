import { Routes } from '@angular/router';
import { ProjectListComponent } from './components/project-list/project-list.component';
import { CanvasHostComponent } from './components/canvas-host/canvas-host.component';
import { SettingsComponent } from './components/settings/settings.component';
import { LlmSettingsComponent } from './components/settings/llm-settings/llm-settings.component';
import { OllamaModelEditorComponent } from './components/settings/llm-settings/ollama-model-editor/ollama-model-editor.component';

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
