import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntil } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { ComponentBase } from '../component-base/component-base.component';
import { ProjectsService } from '../../services/projects.service';
import { DeletionService } from '../../services/deletion.service';
import { Project } from '../../../model/shared-models/project.model';

@Component({
    selector: 'app-project-list',
    standalone: true,
    imports: [
        CommonModule, FormsModule,
        ButtonModule, CardModule, DialogModule,
        InputTextModule, TextareaModule, ConfirmDialogModule, TooltipModule,
    ],
    templateUrl: './project-list.component.html',
    styleUrl: './project-list.component.scss',
})
export class ProjectListComponent extends ComponentBase implements OnInit {

    constructor() { super(); }

    private readonly projectsService = inject(ProjectsService);
    private readonly deletion        = inject(DeletionService);
    private readonly router          = inject(Router);

    projects: Project[] = [];
    loading = true;

    showCreateDialog = false;
    showEditDialog   = false;
    newName        = '';
    newDescription = '';
    editName        = '';
    editDescription = '';
    editingProject: Project | null = null;

    ngOnInit(): void {
        this.projectsService.projects$.pipe(takeUntil(this.ngDestroy$)).subscribe(projects => {
            this.projects = projects;
            this.loading  = false;
        });
    }

    openProject(project: Project): void {
        this.router.navigate(['/projects', project._id]);
    }

    openCreateDialog(): void {
        this.newName        = '';
        this.newDescription = '';
        this.showCreateDialog = true;
    }

    createProject(): void {
        if (!this.newName.trim()) { return; }
        this.projectsService.create(this.newName.trim(), this.newDescription.trim())
            .subscribe(() => {
                this.showCreateDialog = false;
                this.projectsService.reload();
            });
    }

    openEditDialog(project: Project, event: Event): void {
        event.stopPropagation();
        this.editingProject  = project;
        this.editName        = project.name;
        this.editDescription = project.description;
        this.showEditDialog  = true;
    }

    saveEdit(): void {
        if (!this.editingProject || !this.editName.trim()) { return; }
        this.projectsService.update(this.editingProject._id as string, {
            name:        this.editName.trim(),
            description: this.editDescription.trim(),
        }).subscribe(() => {
            this.showEditDialog = false;
            this.editingProject = null;
            this.projectsService.reload();
        });
    }

    deleteProject(project: Project, event: Event): void {
        event.stopPropagation();
        this.deletion.deleteProject(project._id as string, project.name, () => {
            this.projectsService.reload();
        });
    }
}
