import { Component, inject, OnInit, OnDestroy, ElementRef, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { takeUntil, filter } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { FormsModule } from '@angular/forms';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ComponentBase } from '../component-base/component-base.component';
import { ViewportService } from '../../services/viewport.service';
import { CanvasDataService } from '../../services/canvas-data.service';
import { CanvasInteractionService } from '../../services/canvas-interaction.service';
import { SelectionService } from '../../services/selection.service';
import { NavigationService } from '../../services/navigation.service';
import { ProjectsService } from '../../services/projects.service';
import { DeletionService } from '../../services/deletion.service';
import { TaskApiClient } from '../../services/api-clients/task-api.client';
import { TaskCardComponent } from '../canvas/task-card/task-card.component';
import { NoteCardComponent } from '../canvas/note-card/note-card.component';
import { DetailsPaneComponent } from '../details-pane/details-pane.component';
import { CanvasContextMenuComponent, ContextMenuItem } from '../canvas/canvas-context-menu/canvas-context-menu.component';
import { Task } from '../../../model/shared-models/task.model';
import { Note } from '../../../model/shared-models/note.model';
import { Project } from '../../../model/shared-models/project.model';
import { Layout } from '../../../model/shared-models/layout.model';

@Component({
    selector: 'app-canvas-host',
    standalone: true,
    imports: [
        CommonModule, FormsModule,
        ButtonModule, DialogModule, InputTextModule, TextareaModule, ConfirmDialogModule,
        TaskCardComponent, NoteCardComponent, DetailsPaneComponent, CanvasContextMenuComponent,
    ],
    templateUrl: './canvas-host.component.html',
    styleUrl: './canvas-host.component.scss',
    providers: [ViewportService, CanvasDataService, CanvasInteractionService],
})
export class CanvasHostComponent extends ComponentBase implements OnInit {

    constructor() { super(); }

    @ViewChild('canvasArea') canvasAreaRef!: ElementRef<HTMLElement>;

    private readonly route       = inject(ActivatedRoute);
    private readonly router      = inject(Router);
    readonly viewport            = inject(ViewportService);
    readonly canvasData          = inject(CanvasDataService);
    private readonly interaction = inject(CanvasInteractionService);
    private readonly selection   = inject(SelectionService);
    private readonly navigation  = inject(NavigationService);
    private readonly projects    = inject(ProjectsService);
    private readonly deletion    = inject(DeletionService);
    private readonly taskApi     = inject(TaskApiClient);

    tasks: Task[]  = [];
    notes: Note[]  = [];
    hostProject: Project | null = null;
    hostTask: Task | null = null;
    loading = true;

    projectId = '';
    taskIds: string[] = [];

    // Toolbar edit dialog
    showEditDialog  = false;
    editName        = '';
    editDescription = '';

    // Context menu
    contextMenuVisible = false;
    contextMenuX = 0;
    contextMenuY = 0;
    contextMenuCanvasX = 0;
    contextMenuCanvasY = 0;

    readonly contextMenuItems: ContextMenuItem[] = [
        { label: 'Add Task', icon: 'pi-plus-circle', action: 'add-task' },
        { label: 'Add Note', icon: 'pi-file-plus',   action: 'add-note' },
    ];

    ngOnInit(): void {
        // One-time subscriptions — stay alive for the lifetime of the component.
        this.canvasData.tasks.pipe(takeUntil(this.ngDestroy$)).subscribe(t => this.tasks = t);
        this.canvasData.notes.pipe(takeUntil(this.ngDestroy$)).subscribe(n => this.notes = n);

        this.viewport.persistNeeded$.pipe(takeUntil(this.ngDestroy$)).subscribe(vs => {
            const hostId = this.hostTask ? (this.hostTask._id as string) : this.projectId;
            this.canvasData.saveViewState(hostId, !this.hostTask, vs);
        });

        this.interaction.moveEnded$.pipe(takeUntil(this.ngDestroy$)).subscribe(event => {
            if (event.isTask) {
                this.tasks = this.tasks.map(t =>
                    t._id === event.id ? { ...t, layout: event.layout } : t
                );
                this.canvasData.updateTaskLayout(event.id, event.layout);
            } else {
                this.notes = this.notes.map(n =>
                    n._id === event.id ? { ...n, layout: event.layout } : n
                );
                this.canvasData.updateNoteLayout(event.id, event.layout);
            }
        });

        this.interaction.resizeEnded$.pipe(takeUntil(this.ngDestroy$)).subscribe(event => {
            if (event.isTask) {
                this.tasks = this.tasks.map(t =>
                    t._id === event.id ? { ...t, layout: event.layout } : t
                );
                this.canvasData.updateTaskLayout(event.id, event.layout);
            } else {
                this.notes = this.notes.map(n =>
                    n._id === event.id ? { ...n, layout: event.layout } : n
                );
                this.canvasData.updateNoteLayout(event.id, event.layout);
            }
        });

        // Initialize now, then re-initialize whenever Angular reuses this component
        // instance across task-depth navigations (** wildcard route reuse).
        this.initForCurrentUrl();
        this.router.events.pipe(
            filter(e => e instanceof NavigationEnd),
            takeUntil(this.ngDestroy$),
        ).subscribe(() => this.initForCurrentUrl());
    }

    private initForCurrentUrl(): void {
        this.navigation.parseCurrentUrl();
        const newProjectId = this.navigation.currentProjectId ?? '';
        const newTaskIds   = this.navigation.currentTaskIds;

        // Guard against spurious NavigationEnd fires with the same URL.
        if (newProjectId === this.projectId
            && newTaskIds.length === this.taskIds.length
            && newTaskIds.every((id, i) => id === this.taskIds[i])) {
            return;
        }

        this.projectId = newProjectId;
        this.taskIds   = newTaskIds;

        const parentTaskId = this.taskIds.length > 0 ? this.taskIds[this.taskIds.length - 1] : undefined;

        this.selection.clear();
        this.loading     = true;
        this.hostTask    = null;
        this.hostProject = null;

        this.canvasData.initialize(this.projectId, parentTaskId, this.taskIds);

        if (parentTaskId) {
            this.taskApi.getById(parentTaskId).subscribe(task => {
                this.hostTask = task;
                this.viewport.restore(task.viewState);
                this.loading = false;
            });
        } else {
            this.projects.getById(this.projectId).subscribe(project => {
                this.hostProject = project;
                this.viewport.restore(project.viewState);
                this.loading = false;
            });
        }
    }

    override ngOnDestroy(): void {
        this.selection.clear();
        super.ngOnDestroy();
    }

    get transform(): string {
        return this.viewport.cssTransform;
    }

    // --- Canvas events ---

    onCanvasMousedown(e: MouseEvent): void {
        this.interaction.onCanvasMousedown(e);
    }

    onCanvasWheel(e: WheelEvent): void {
        if (this.canvasAreaRef) {
            this.interaction.onWheel(e, this.canvasAreaRef.nativeElement.getBoundingClientRect());
        }
    }

    onCanvasClick(e: MouseEvent): void {
        // Click on empty canvas → clear selection, show host
        this.selection.clear();
        this.contextMenuVisible = false;
    }

    onContextMenu(e: MouseEvent): void {
        e.preventDefault();
        const rect = this.canvasAreaRef.nativeElement.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const canvasPos = this.viewport.screenToCanvas(screenX, screenY);
        this.contextMenuCanvasX = canvasPos.x;
        this.contextMenuCanvasY = canvasPos.y;
        this.contextMenuX = e.clientX;
        this.contextMenuY = e.clientY;
        this.contextMenuVisible = true;
    }

    onContextMenuAction(action: string): void {
        this.contextMenuVisible = false;
        if (action === 'add-task') {
            this.canvasData.addTask(this.contextMenuCanvasX, this.contextMenuCanvasY)
                .subscribe(task => this.selection.select({ type: 'task', item: task }));
        } else if (action === 'add-note') {
            this.canvasData.addNote(this.contextMenuCanvasX, this.contextMenuCanvasY)
                .subscribe(note => this.selection.select({ type: 'note', item: note }));
        }
    }

    // --- Card events ---

    onTaskSelected(task: Task): void {
        this.canvasData.bringToFront(task._id as string, true);
        this.selection.select({ type: 'task', item: task });
    }

    onNoteSelected(note: Note): void {
        this.canvasData.bringToFront(note._id as string, false);
        this.selection.select({ type: 'note', item: note });
    }

    onDrillIntoTask(task: Task): void {
        const chain = [...this.taskIds, task._id as string];
        this.navigation.drillIntoTask(this.projectId, chain);
    }

    isTaskSelected(task: Task): boolean {
        const sel = this.selection.current;
        return sel?.type === 'task' && sel.item._id === task._id;
    }

    isNoteSelected(note: Note): boolean {
        const sel = this.selection.current;
        return sel?.type === 'note' && sel.item._id === note._id;
    }

    // --- Toolbar ---

    goBack(): void {
        this.navigation.navigateToParent();
    }

    openEditDialog(): void {
        if (this.hostTask) {
            this.editName        = this.hostTask.title;
            this.editDescription = this.hostTask.description;
        } else if (this.hostProject) {
            this.editName        = this.hostProject.name;
            this.editDescription = this.hostProject.description;
        }
        this.showEditDialog = true;
    }

    saveEdit(): void {
        if (!this.editName.trim()) { return; }
        if (this.hostTask) {
            const updated = { ...this.hostTask, title: this.editName.trim(), description: this.editDescription.trim() };
            this.canvasData.updateTask(updated).subscribe(t => {
                this.hostTask = t;
                this.showEditDialog = false;
            });
        } else if (this.hostProject) {
            this.projects.update(this.projectId, {
                name:        this.editName.trim(),
                description: this.editDescription.trim(),
            }).subscribe(p => {
                this.hostProject = p;
                this.showEditDialog = false;
            });
        }
    }

    deleteHost(): void {
        if (this.hostTask) {
            this.deletion.deleteTask(this.hostTask._id as string, this.hostTask.title, () => {
                this.navigation.navigateToParent();
            });
        } else if (this.hostProject) {
            this.deletion.deleteProject(this.projectId, this.hostProject.name, () => {
                this.navigation.navigateToProjects();
            });
        }
    }

    @HostListener('document:keydown', ['$event'])
    onDocumentKeydown(e: KeyboardEvent): void {
        if (e.key !== 'Delete') { return; }
        const tag = (e.target as HTMLElement).tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement).isContentEditable) { return; }

        const sel = this.selection.current;
        if (sel?.type === 'task') {
            this.deletion.deleteTask(sel.item._id as string, sel.item.title, () => {
                this.canvasData.removeTask(sel.item._id as string);
            });
        } else if (sel?.type === 'note') {
            this.deletion.deleteNote(sel.item._id as string, sel.item.title, () => {
                this.canvasData.removeNote(sel.item._id as string);
            });
        }
    }

    fitAll(): void {
        if (!this.canvasAreaRef) { return; }
        const rect = this.canvasAreaRef.nativeElement.getBoundingClientRect();
        const layouts = [
            ...this.tasks.map(t => t.layout),
            ...this.notes.map(n => n.layout),
        ];
        this.viewport.zoomToFit(layouts, rect.width, rect.height);
    }

    get hostDisplayName(): string {
        return this.hostTask?.title ?? this.hostProject?.name ?? '…';
    }

    get isTaskCanvas(): boolean {
        return !!this.hostTask;
    }
}
