import { Component, inject, OnInit, OnDestroy, ElementRef, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { takeUntil, filter, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
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
import { GroupCardComponent } from '../canvas/group-card/group-card.component';
import { DetailsPaneComponent } from '../details-pane/details-pane.component';
import { CanvasContextMenuComponent, ContextMenuItem } from '../canvas/canvas-context-menu/canvas-context-menu.component';
import { Task } from '../../../model/shared-models/task.model';
import { Note } from '../../../model/shared-models/note.model';
import { Group } from '../../../model/shared-models/group.model';
import { Project } from '../../../model/shared-models/project.model';
import { Layout } from '../../../model/shared-models/layout.model';
import { TaskCounts } from '../../../model/shared-models/task-counts.model';

@Component({
    selector: 'app-canvas-host',
    standalone: true,
    imports: [
        CommonModule, FormsModule,
        ButtonModule, DialogModule, InputTextModule, TextareaModule, ConfirmDialogModule,
        TaskCardComponent, NoteCardComponent, GroupCardComponent,
        DetailsPaneComponent, CanvasContextMenuComponent,
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

    tasks:      Task[]   = [];
    notes:      Note[]   = [];
    groups:     Group[]  = [];
    taskCounts: Record<string, TaskCounts> = {};
    hostProject: Project | null = null;
    hostTask: Task | null = null;
    loading = true;

    projectId = '';
    taskIds: string[] = [];

    showEditDialog  = false;
    editName        = '';
    editDescription = '';

    contextMenuVisible = false;
    contextMenuX = 0;
    contextMenuY = 0;
    contextMenuCanvasX = 0;
    contextMenuCanvasY = 0;

    readonly contextMenuItems: ContextMenuItem[] = [
        { label: 'Add Task',  icon: 'pi-plus-circle', action: 'add-task'  },
        { label: 'Add Note',  icon: 'pi-file-plus',   action: 'add-note'  },
        { label: 'Add Group', icon: 'pi-th-large',    action: 'add-group' },
    ];

    ngOnInit(): void {
        this.canvasData.tasks.pipe(takeUntil(this.ngDestroy$)).subscribe(t => this.tasks = t);
        this.canvasData.notes.pipe(takeUntil(this.ngDestroy$)).subscribe(n => this.notes = n);
        this.canvasData.groups.pipe(takeUntil(this.ngDestroy$)).subscribe(g => this.groups = g);
        this.canvasData.taskCounts.pipe(takeUntil(this.ngDestroy$)).subscribe(c => this.taskCounts = c);

        this.viewport.persistNeeded$.pipe(takeUntil(this.ngDestroy$)).subscribe(vs => {
            const hostId = this.hostTask ? (this.hostTask._id as string) : this.projectId;
            this.canvasData.saveViewState(hostId, !this.hostTask, vs);
        });

        this.interaction.moveEnded$.pipe(takeUntil(this.ngDestroy$)).subscribe(event => {
            if (event.itemType === 'group') {
                this.groups = this.groups.map(g =>
                    (g._id as any) === event.id ? { ...g, layout: event.layout } : g
                );
                this.canvasData.updateGroupLayout(event.id, event.layout);
                return;
            }

            if (event.fromGroupDrag) {
                if (event.isTask) {
                    this.tasks = this.tasks.map(t =>
                        (t._id as any) === event.id ? { ...t, layout: event.layout } : t
                    );
                    this.canvasData.updateTaskLayout(event.id, event.layout);
                } else {
                    this.notes = this.notes.map(n =>
                        (n._id as any) === event.id ? { ...n, layout: event.layout } : n
                    );
                    this.canvasData.updateNoteLayout(event.id, event.layout);
                }
                return;
            }

            if (event.isTask) {
                this.tasks = this.tasks.map(t =>
                    (t._id as any) === event.id ? { ...t, layout: event.layout } : t
                );
                const task = this.tasks.find(t => (t._id as any) === event.id);
                if (task) { this.handleTaskGroupInteraction(task, event.layout); }
            } else {
                this.notes = this.notes.map(n =>
                    (n._id as any) === event.id ? { ...n, layout: event.layout } : n
                );
                this.canvasData.updateNoteLayout(event.id, event.layout);
            }
        });

        this.interaction.resizeEnded$.pipe(takeUntil(this.ngDestroy$)).subscribe(event => {
            if (event.itemType === 'group') {
                this.canvasData.relayoutGroup(event.id, this.tasks, event.layout)
                    .pipe(takeUntil(this.ngDestroy$))
                    .subscribe(updated => {
                        this.tasks = this.tasks.map(t => {
                            const u = updated.find(ut => (ut._id as any) === (t._id as any));
                            return u ?? t;
                        });
                    });
                return;
            }

            if (event.isTask) {
                this.tasks = this.tasks.map(t =>
                    (t._id as any) === event.id ? { ...t, layout: event.layout } : t
                );
                this.canvasData.updateTaskLayout(event.id, event.layout);
            } else {
                this.notes = this.notes.map(n =>
                    (n._id as any) === event.id ? { ...n, layout: event.layout } : n
                );
                this.canvasData.updateNoteLayout(event.id, event.layout);
            }
        });

        this.initForCurrentUrl();
        this.router.events.pipe(
            filter(e => e instanceof NavigationEnd),
            takeUntil(this.ngDestroy$),
        ).subscribe(() => this.initForCurrentUrl());
    }

    private handleTaskGroupInteraction(task: Task, droppedLayout: Layout): void {
        const cx = droppedLayout.x + droppedLayout.width  / 2;
        const cy = droppedLayout.y + droppedLayout.height / 2;

        const targetGroup = this.groups.find(g => {
            const l = g.layout;
            return cx >= l.x && cx <= l.x + l.width && cy >= l.y && cy <= l.y + l.height;
        }) ?? null;

        const currentGroupId = task.groupId ?? null;
        const targetGroupId  = targetGroup ? (targetGroup._id as string) : null;

        if (currentGroupId === targetGroupId) {
            if (!currentGroupId) {
                this.canvasData.updateTaskLayout(task._id as string, droppedLayout);
            } else {
                // Still in same group — snap back to group-managed layout
                this.canvasData.relayoutGroup(currentGroupId, this.tasks)
                    .pipe(takeUntil(this.ngDestroy$))
                    .subscribe(updated => {
                        this.tasks = this.tasks.map(t => {
                            const u = updated.find(ut => (ut._id as any) === (t._id as any));
                            return u ?? t;
                        });
                    });
            }
            return;
        }

        if (currentGroupId && !targetGroup) {
            this.canvasData.exitGroup(task._id as string, currentGroupId, droppedLayout)
                .pipe(takeUntil(this.ngDestroy$))
                .subscribe(({ updatedTask, updatedGroup, relayoutedTasks }) => {
                    this.tasks = this.tasks.map(t => {
                        if ((t._id as any) === (updatedTask._id as any)) { return updatedTask; }
                        const r = relayoutedTasks.find(rt => (rt._id as any) === (t._id as any));
                        return r ?? t;
                    });
                    this.groups = this.groups.map(g =>
                        (g._id as any) === (updatedGroup._id as any) ? updatedGroup : g
                    );
                });
            return;
        }

        if (!currentGroupId && targetGroup) {
            this.canvasData.enterGroup(task._id as string, targetGroup._id as string)
                .pipe(takeUntil(this.ngDestroy$))
                .subscribe(({ updatedTasks, updatedGroup }) => {
                    this.tasks = this.tasks.map(t => {
                        const u = updatedTasks.find(ut => (ut._id as any) === (t._id as any));
                        return u ?? t;
                    });
                    this.groups = this.groups.map(g =>
                        (g._id as any) === (updatedGroup._id as any) ? updatedGroup : g
                    );
                });
            return;
        }

        if (currentGroupId && targetGroup && currentGroupId !== targetGroupId) {
            this.canvasData.moveTaskBetweenGroups(task._id as string, currentGroupId, targetGroupId!)
                .pipe(takeUntil(this.ngDestroy$))
                .subscribe(({ updatedTasks, updatedGroups }) => {
                    this.tasks = this.tasks.map(t => {
                        const u = updatedTasks.find(ut => (ut._id as any) === (t._id as any));
                        return u ?? t;
                    });
                    this.groups = this.groups.map(g => {
                        const u = updatedGroups.find(ug => (ug._id as any) === (g._id as any));
                        return u ?? g;
                    });
                });
        }
    }

    private initForCurrentUrl(): void {
        this.navigation.parseCurrentUrl();
        const newProjectId = this.navigation.currentProjectId ?? '';
        const newTaskIds   = this.navigation.currentTaskIds;

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
            this.taskApi.getById(parentTaskId).pipe(
                catchError(() => of(null)),
            ).subscribe(task => {
                this.hostTask = task;
                this.viewport.restore(task?.viewState);
                this.loading = false;
            });
        } else {
            this.projects.getById(this.projectId).pipe(
                catchError(() => of(null)),
            ).subscribe(project => {
                this.hostProject = project;
                this.viewport.restore(project?.viewState);
                this.loading = false;
            });
        }
    }

    override ngOnDestroy(): void {
        this.selection.clear();
        super.ngOnDestroy();
    }

    get transform(): string { return this.viewport.cssTransform; }

    get gridStyle(): Record<string, string> {
        const { panX, panY, zoom } = this.viewport.current;
        const spacing = 24 * zoom;
        return {
            'background-size':     `${spacing}px ${spacing}px`,
            'background-position': `${panX}px ${panY}px`,
        };
    }

    onCanvasMousedown(e: MouseEvent): void { this.interaction.onCanvasMousedown(e); }

    onCanvasWheel(e: WheelEvent): void {
        if (this.canvasAreaRef) {
            this.interaction.onWheel(e, this.canvasAreaRef.nativeElement.getBoundingClientRect());
        }
    }

    onCanvasClick(e: MouseEvent): void {
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
        } else if (action === 'add-group') {
            this.canvasData.addGroup(this.contextMenuCanvasX, this.contextMenuCanvasY)
                .subscribe(group => this.selection.select({ type: 'group', item: group }));
        }
    }

    onTaskSelected(task: Task): void {
        this.canvasData.bringToFront(task._id as string, true);
        this.selection.select({ type: 'task', item: task });
    }

    onNoteSelected(note: Note): void {
        this.canvasData.bringToFront(note._id as string, false);
        this.selection.select({ type: 'note', item: note });
    }

    onNoteEdited(note: Note, edit: { title: string; details: string }): void {
        const current = this.canvasData.getNoteById(note._id as string) ?? note;
        this.canvasData.updateNote({ ...current, title: edit.title, details: edit.details })
            .subscribe(result => {
                if (this.isNoteSelected(result)) {
                    this.selection.select({ type: 'note', item: result });
                }
            });
    }

    onGroupSelected(group: Group): void {
        this.canvasData.bringGroupToFront(group._id as string);
        this.selection.select({ type: 'group', item: group });
    }

    onGroupTitleChanged(group: Group, title: string): void {
        this.canvasData.updateGroupTitle(group._id as string, title);
        this.groups = this.groups.map(g =>
            (g._id as any) === (group._id as any) ? { ...g, title } : g
        );
    }

    onGroupLayoutConfigChanged(group: Group, config: { direction: 'vertical' | 'horizontal'; wrap: boolean }): void {
        this.canvasData.updateGroupLayoutConfig(group._id as string, config.direction, config.wrap, this.tasks)
            .pipe(takeUntil(this.ngDestroy$))
            .subscribe(updatedTasks => {
                this.tasks = this.tasks.map(t => {
                    const u = updatedTasks.find(ut => (ut._id as any) === (t._id as any));
                    return u ?? t;
                });
            });
    }

    onDrillIntoTask(task: Task): void {
        const chain = [...this.taskIds, task._id as string];
        this.navigation.drillIntoTask(this.projectId, chain);
    }

    onTaskEdited(task: Task, edit: { title: string; description: string }): void {
        const current = this.canvasData.getTaskById(task._id as string) ?? task;
        this.canvasData.updateTask({ ...current, title: edit.title, description: edit.description })
            .subscribe(result => {
                if (this.isTaskSelected(result)) {
                    this.selection.select({ type: 'task', item: result });
                }
            });
    }

    getGroupContainedItems(group: Group): Array<{ id: string; isTask: boolean; layout: Layout }> {
        return this.tasks
            .filter(t => group.itemIds.includes(t._id as string))
            .map(t => ({ id: t._id as string, isTask: true, layout: t.layout }));
    }

    isTaskSelected(task: Task): boolean {
        const sel = this.selection.current;
        return sel?.type === 'task' && sel.item._id === task._id;
    }

    isNoteSelected(note: Note): boolean {
        const sel = this.selection.current;
        return sel?.type === 'note' && sel.item._id === note._id;
    }

    isGroupSelected(group: Group): boolean {
        const sel = this.selection.current;
        return sel?.type === 'group' && (sel.item._id as any) === (group._id as any);
    }

    goBack(): void { this.navigation.navigateToParent(); }

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
        } else if (sel?.type === 'group') {
            this.deletion.deleteGroup(sel.item._id as string, sel.item.title, () => {
                this.canvasData.deleteGroup(sel.item._id as string)
                    .pipe(takeUntil(this.ngDestroy$))
                    .subscribe();
            });
        }
    }

    fitAll(): void {
        if (!this.canvasAreaRef) { return; }
        const rect = this.canvasAreaRef.nativeElement.getBoundingClientRect();
        const layouts = [
            ...this.tasks.map(t => t.layout),
            ...this.notes.map(n => n.layout),
            ...this.groups.map(g => g.layout),
        ];
        this.viewport.zoomToFit(layouts, rect.width, rect.height);
    }

    get hostDisplayName(): string { return this.hostTask?.title ?? this.hostProject?.name ?? '…'; }
    get isTaskCanvas(): boolean   { return !!this.hostTask; }
}
