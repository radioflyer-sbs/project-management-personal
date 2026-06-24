import { Component, inject, OnInit, ElementRef, ViewChild, HostListener, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { takeUntil, filter, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';
import { FormsModule } from '@angular/forms';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { ComponentBase } from '../component-base/component-base.component';
import { ViewportService } from '../../services/viewport.service';
import { CanvasDataService } from '../../services/canvas-data.service';
import { CanvasInteractionService } from '../../services/canvas-interaction.service';
import { SelectionService, SelectableItem } from '../../services/selection.service';
import { NavigationService } from '../../services/navigation.service';
import { ProjectsService } from '../../services/projects.service';
import { DeletionService } from '../../services/deletion.service';
import { TaskApiClient } from '../../services/api-clients/task-api.client';
import { NoteApiClient } from '../../services/api-clients/note-api.client';
import { DashboardApiClient } from '../../services/api-clients/dashboard-api.client';
import { AppStateApiClient } from '../../services/api-clients/app-state-api.client';
import { TaskCardComponent } from '../canvas/task-card/task-card.component';
import { NoteCardComponent } from '../canvas/note-card/note-card.component';
import { GroupCardComponent } from '../canvas/group-card/group-card.component';
import { DashboardCardComponent } from '../canvas/dashboard-card/dashboard-card.component';
import { DetailsPaneComponent } from '../details-pane/details-pane.component';
import { ReadingPaneComponent } from '../reading-pane/reading-pane.component';
import { CanvasContextMenuComponent, ContextMenuItem } from '../canvas/canvas-context-menu/canvas-context-menu.component';
import { Task } from '../../../model/shared-models/task.model';
import { Note } from '../../../model/shared-models/note.model';
import { Group } from '../../../model/shared-models/group.model';
import { Dashboard } from '../../../model/shared-models/dashboard.model';
import { Project } from '../../../model/shared-models/project.model';
import { Layout } from '../../../model/shared-models/layout.model';
import { TaskCounts } from '../../../model/shared-models/task-counts.model';
import { TaskUrgency } from '../../../model/shared-models/task-urgency.enum';

@Component({
    selector: 'app-canvas-host',
    standalone: true,
    imports: [
        CommonModule, FormsModule,
        ButtonModule, DialogModule, InputTextModule, TextareaModule, ConfirmDialogModule, TooltipModule,
        TaskCardComponent, NoteCardComponent, GroupCardComponent, DashboardCardComponent,
        DetailsPaneComponent, CanvasContextMenuComponent, ReadingPaneComponent,
    ],
    templateUrl: './canvas-host.component.html',
    styleUrl: './canvas-host.component.scss',
    providers: [ViewportService, CanvasDataService, CanvasInteractionService],
})
export class CanvasHostComponent extends ComponentBase implements OnInit {

    constructor() { super(); }

    @ViewChild('canvasArea')        canvasAreaRef!: ElementRef<HTMLElement>;
    @ViewChild('rubberBandOverlay') rubberBandOverlayRef?: ElementRef<HTMLElement>;

    private readonly router        = inject(Router);
    readonly viewport              = inject(ViewportService);
    readonly canvasData            = inject(CanvasDataService);
    private readonly interaction   = inject(CanvasInteractionService);
    private readonly selection     = inject(SelectionService);
    private readonly navigation    = inject(NavigationService);
    private readonly projects      = inject(ProjectsService);
    private readonly deletion      = inject(DeletionService);
    private readonly taskApi       = inject(TaskApiClient);
    private readonly noteApi       = inject(NoteApiClient);
    private readonly dashboardApi  = inject(DashboardApiClient);
    private readonly appStateApi   = inject(AppStateApiClient);
    private readonly confirmation  = inject(ConfirmationService);
    private readonly zone          = inject(NgZone);

    tasks:      Task[]      = [];
    notes:      Note[]      = [];
    groups:     Group[]     = [];
    dashboards: Dashboard[] = [];
    taskCounts: Record<string, TaskCounts> = {};
    hostProject: Project | null = null;
    hostTask: Task | null = null;
    loading = true;

    projectId = '';
    taskIds: string[] = [];

    readingPaneVisible = false;

    showEditDialog  = false;
    editName        = '';
    editDescription = '';

    showNewDashboardDialog = false;
    newDashboardTitle      = '';
    newDashboardKey        = '';

    contextMenuVisible = false;
    contextMenuX = 0;
    contextMenuY = 0;
    contextMenuCanvasX = 0;
    contextMenuCanvasY = 0;

    // Per-card (task) context menu — currently hosts the "Promote" action.
    cardMenuVisible = false;
    cardMenuX = 0;
    cardMenuY = 0;
    cardMenuItems: ContextMenuItem[] = [];

    private shiftHeld = false;

    readonly contextMenuItems: ContextMenuItem[] = [
        { label: 'Add Task',      icon: 'pi-plus-circle',  action: 'add-task'      },
        { label: 'Add Note',      icon: 'pi-file-plus',    action: 'add-note'      },
        { label: 'Add Group',     icon: 'pi-th-large',     action: 'add-group'     },
        { label: 'Add Dashboard', icon: 'pi-chart-bar',    action: 'add-dashboard' },
    ];

    ngOnInit(): void {
        this.canvasData.tasks.pipe(takeUntil(this.ngDestroy$)).subscribe(t => this.tasks = t);
        this.canvasData.notes.pipe(takeUntil(this.ngDestroy$)).subscribe(n => this.notes = n);
        this.canvasData.groups.pipe(takeUntil(this.ngDestroy$)).subscribe(g => this.groups = g);
        this.canvasData.dashboards.pipe(takeUntil(this.ngDestroy$)).subscribe(d => this.dashboards = d);
        this.canvasData.taskCounts.pipe(takeUntil(this.ngDestroy$)).subscribe(c => this.taskCounts = c);

        this.viewport.persistNeeded$.pipe(takeUntil(this.ngDestroy$)).subscribe(vs => {
            const hostId = this.hostTask ? (this.hostTask._id as string) : this.projectId;
            this.canvasData.saveViewState(hostId, !this.hostTask, vs);
        });

        this.interaction.moveEnded$.pipe(takeUntil(this.ngDestroy$)).subscribe(event => {
            if (event.itemType === 'group') {
                if (!event.hasMoved) { return; }
                this.groups = this.groups.map(g =>
                    (g._id as any) === event.id ? { ...g, layout: event.layout } : g
                );
                this.canvasData.updateGroupLayout(event.id, event.layout);
                return;
            }

            // Dashboard move — MongoDB IDs are unique, so ID match is sufficient
            const dashboardMatch = this.dashboards.find(d => (d._id as any) === event.id);
            if (dashboardMatch) {
                if (!event.hasMoved) { return; }
                this.dashboards = this.dashboards.map(d =>
                    (d._id as any) === event.id ? { ...d, layout: event.layout } : d
                );
                this.canvasData.updateDashboardLayout(event.id, event.layout);
                return;
            }

            if (event.fromGroupDrag) {
                if (!event.hasMoved) { return; }
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

            if (!event.hasMoved) { return; }

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

            const dashboardResizeMatch = this.dashboards.find(d => (d._id as any) === event.id);
            if (dashboardResizeMatch) {
                this.dashboards = this.dashboards.map(d =>
                    (d._id as any) === event.id ? { ...d, layout: event.layout } : d
                );
                this.canvasData.updateDashboardLayout(event.id, event.layout);
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

        // A drag released over a task's drop zone — confirm, then reparent the dragged items
        // under that task (their layouts are preserved). Fired outside the Angular zone.
        this.interaction.reparentDrop$.pipe(takeUntil(this.ngDestroy$)).subscribe(({ targetTaskId, draggedIds }) => {
            this.zone.run(() => this.handleReparentDrop(targetTaskId, draggedIds));
        });

        this.initForCurrentUrl();
        this.router.events.pipe(
            filter(e => e instanceof NavigationEnd),
            takeUntil(this.ngDestroy$),
        ).subscribe(() => this.initForCurrentUrl());
    }

    /**
     * Determines the new itemIds order for a group after a task is dropped onto it.
     * For within-group reorder: backward movement inserts before nearest, forward inserts after.
     * For entering/between-groups: inserts before/after nearest item based on drop half.
     */
    private computeGroupItemOrder(group: Group, draggedTaskId: string, dropLayout: Layout): string[] {
        const dir = group.layoutDirection ?? 'vertical';
        const dropCX = dropLayout.x + dropLayout.width  / 2;
        const dropCY = dropLayout.y + dropLayout.height / 2;

        const originalIdx = group.itemIds.indexOf(draggedTaskId);
        const otherIds    = group.itemIds.filter(id => id !== draggedTaskId);

        if (otherIds.length === 0) { return [draggedTaskId]; }

        let nearestLocalIdx = 0;
        let nearestId       = otherIds[0];
        let nearestDist     = Infinity;

        otherIds.forEach((id, i) => {
            const t = this.tasks.find(t => (t._id as any) === id);
            if (!t) { return; }
            const dist = Math.hypot(
                (t.layout.x + t.layout.width  / 2) - dropCX,
                (t.layout.y + t.layout.height / 2) - dropCY,
            );
            if (dist < nearestDist) { nearestDist = dist; nearestLocalIdx = i; nearestId = id; }
        });

        let insertBefore: boolean;

        if (originalIdx !== -1) {
            // Within-group reorder: moving backward (to lower index) → before; forward → after
            const nearestOriginalIdx = group.itemIds.indexOf(nearestId);
            insertBefore = originalIdx > nearestOriginalIdx;
        } else {
            // Entering from outside: use midpoint of nearest item
            const nearestTask = this.tasks.find(t => (t._id as any) === nearestId);
            if (nearestTask) {
                insertBefore = dir === 'vertical'
                    ? dropCY < nearestTask.layout.y + nearestTask.layout.height / 2
                    : dropCX < nearestTask.layout.x + nearestTask.layout.width  / 2;
            } else {
                insertBefore = false;
            }
        }

        const finalIds = [...otherIds];
        finalIds.splice(insertBefore ? nearestLocalIdx : nearestLocalIdx + 1, 0, draggedTaskId);
        return finalIds;
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
                // Within same group — reorder based on drop position
                const group = this.groups.find(g => (g._id as any) === currentGroupId);
                if (group) {
                    const newOrder = this.computeGroupItemOrder(group, task._id as string, droppedLayout);
                    this.canvasData.reorderGroup(currentGroupId, newOrder, this.tasks)
                        .pipe(takeUntil(this.ngDestroy$))
                        .subscribe(updated => {
                            this.tasks = this.tasks.map(t => {
                                const u = updated.find(ut => (ut._id as any) === (t._id as any));
                                return u ?? t;
                            });
                        });
                }
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
            const newOrder = this.computeGroupItemOrder(targetGroup, task._id as string, droppedLayout);
            this.canvasData.enterGroup(task._id as string, targetGroup._id as string, newOrder)
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
            const newToOrder = this.computeGroupItemOrder(targetGroup, task._id as string, droppedLayout);
            this.canvasData.moveTaskBetweenGroups(task._id as string, currentGroupId, targetGroupId!, newToOrder)
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
                this.appStateApi.set('current-view', {
                    projectId:    this.projectId,
                    parentTaskId,
                    ancestorTaskIds: this.taskIds,
                    title: task?.title ?? parentTaskId,
                }).subscribe();
            });
        } else {
            this.projects.getById(this.projectId).pipe(
                catchError(() => of(null)),
            ).subscribe(project => {
                this.hostProject = project;
                this.viewport.restore(project?.viewState);
                this.loading = false;
                this.appStateApi.set('current-view', {
                    projectId:    this.projectId,
                    parentTaskId: null,
                    ancestorTaskIds: [],
                    title: project?.name ?? this.projectId,
                }).subscribe();
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

    onCanvasMousedown(e: MouseEvent): void {
        if (e.button === 2) { this.interaction.onCanvasMousedown(e); return; }
        if (e.button !== 0) { return; }

        const canvasAreaEl = this.canvasAreaRef.nativeElement;
        const areaRect     = canvasAreaEl.getBoundingClientRect();
        const startX = e.clientX - areaRect.left;
        const startY = e.clientY - areaRect.top;
        const shiftKey = e.shiftKey;
        const ctrlKey  = e.ctrlKey || e.metaKey;

        let curX = startX;
        let curY = startY;

        this.zone.runOutsideAngular(() => {
            const onMove = (me: MouseEvent) => {
                const r = canvasAreaEl.getBoundingClientRect();
                curX = me.clientX - r.left;
                curY = me.clientY - r.top;
                const x = Math.min(startX, curX);
                const y = Math.min(startY, curY);
                const w = Math.abs(curX - startX);
                const h = Math.abs(curY - startY);
                this.applyRubberBand(x, y, w, h);
            };

            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup',  onUp);

                const w = Math.abs(curX - startX);
                const h = Math.abs(curY - startY);
                this.clearRubberBand();

                this.zone.run(() => {
                    if (w < 5 && h < 5) {
                        // Treat as a click on empty canvas
                        if (!shiftKey && !ctrlKey) { this.selection.clear(); }
                    } else {
                        // Actual rubber-band: convert to canvas coordinates
                        const c1 = this.viewport.screenToCanvas(Math.min(startX, curX), Math.min(startY, curY));
                        const c2 = this.viewport.screenToCanvas(Math.max(startX, curX), Math.max(startY, curY));
                        const selRect = { x: c1.x, y: c1.y, w: c2.x - c1.x, h: c2.y - c1.y };
                        const hits = this.findItemsInRect(selRect);

                        if (shiftKey) {
                            this.selection.addMany(hits);
                        } else if (ctrlKey) {
                            this.selection.removeIds(hits.map(h => h.item._id as string));
                        } else {
                            this.selection.selectMany(hits);
                        }
                    }
                });
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup',  onUp);
        });
    }

    private applyRubberBand(x: number, y: number, w: number, h: number): void {
        const el = this.rubberBandOverlayRef?.nativeElement;
        if (!el) { return; }
        el.style.display = 'block';
        el.style.left    = `${x}px`;
        el.style.top     = `${y}px`;
        el.style.width   = `${w}px`;
        el.style.height  = `${h}px`;
    }

    private clearRubberBand(): void {
        const el = this.rubberBandOverlayRef?.nativeElement;
        if (el) { el.style.display = 'none'; }
    }

    private findItemsInRect(rect: { x: number; y: number; w: number; h: number }): SelectableItem[] {
        const hits: SelectableItem[] = [];
        const overlaps = (l: Layout) =>
            l.x < rect.x + rect.w && l.x + l.width  > rect.x &&
            l.y < rect.y + rect.h && l.y + l.height > rect.y;

        this.tasks.forEach(t => { if (overlaps(t.layout)) { hits.push({ type: 'task',  item: t }); } });
        this.notes.forEach(n => { if (overlaps(n.layout)) { hits.push({ type: 'note',  item: n }); } });
        this.groups.forEach(g => { if (overlaps(g.layout)) { hits.push({ type: 'group', item: g }); } });
        return hits;
    }

    onCanvasWheel(e: WheelEvent): void {
        if (this.canvasAreaRef) {
            this.interaction.onWheel(e, this.canvasAreaRef.nativeElement.getBoundingClientRect());
        }
    }

    onCanvasClick(): void {
        this.contextMenuVisible = false;
        // Selection clearing on empty-canvas click is handled in onCanvasMousedown's mouseup handler.
    }

    onContextMenu(e: MouseEvent): void {
        e.preventDefault();
        // A right-drag is a pan, not a context-menu request — swallow the menu that follows it.
        if (this.interaction.consumeDidPan()) { return; }
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
        } else if (action === 'add-dashboard') {
            this.newDashboardTitle = 'Dashboard';
            this.newDashboardKey   = `dashboard-${Date.now()}`;
            this.showNewDashboardDialog = true;
        }
    }

    createDashboard(): void {
        if (!this.newDashboardTitle.trim() || !this.newDashboardKey.trim()) { return; }
        this.canvasData.addDashboard(
            this.contextMenuCanvasX, this.contextMenuCanvasY,
            this.newDashboardTitle.trim(), this.newDashboardKey.trim()
        ).subscribe({
            next: () => { this.showNewDashboardDialog = false; },
            error: err => {
                if (err.status === 409) { alert(`Dashboard key '${this.newDashboardKey}' already exists.`); }
            },
        });
    }

    onDashboardUpdated(updated: Dashboard): void {
        this.dashboards = this.dashboards.map(d => (d._id as any) === (updated._id as any) ? updated : d);
    }

    onDashboardDeleted(dashboardId: string): void {
        this.canvasData.removeDashboard(dashboardId);
    }

    onDashboardDragStarted(dashboard: Dashboard, e: PointerEvent): void {
        const current = this.dashboards.find(d => (d._id as any) === (dashboard._id as any)) ?? dashboard;
        this.interaction.startMove(e, current._id as string, false, current.layout);
    }

    onDashboardResizeStarted(dashboard: Dashboard, event: { handle: string; e: PointerEvent }): void {
        this.interaction.startResize(event.e, dashboard._id as string, false, event.handle as any, dashboard.layout);
    }

    fitToDashboard(dashboard: Dashboard): void {
        if (!this.canvasAreaRef) { return; }
        const rect = this.canvasAreaRef.nativeElement.getBoundingClientRect();
        this.viewport.zoomToFit([dashboard.layout], rect.width, rect.height);
    }

    onTaskSelected(task: Task): void {
        this.canvasData.bringToFront(task._id as string, true);
        if (!this.shiftHeld && this.selection.isSelected(task._id as string)) { return; }
        this.selection.select({ type: 'task', item: task }, this.shiftHeld);
    }

    onNoteSelected(note: Note): void {
        this.canvasData.bringToFront(note._id as string, false);
        if (!this.shiftHeld && this.selection.isSelected(note._id as string)) { return; }
        this.selection.select({ type: 'note', item: note }, this.shiftHeld);
    }

    onNoteEdited(note: Note, edit: { title: string; details: string }): void {
        const current = this.canvasData.getNoteById(note._id as string) ?? note;
        this.canvasData.updateNote({ ...current, title: edit.title, details: edit.details })
            .subscribe(result => {
                if (this.selection.isSelected(result._id as string)) {
                    this.selection.updateItem({ type: 'note', item: result });
                }
            });
    }

    onGroupSelected(group: Group): void {
        this.canvasData.bringGroupToFront(group._id as string);
        if (!this.shiftHeld && this.selection.isSelected(group._id as string)) { return; }
        this.selection.select({ type: 'group', item: group }, this.shiftHeld);
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
                if (this.selection.isSelected(result._id as string)) {
                    this.selection.updateItem({ type: 'task', item: result });
                }
            });
    }

    onTaskUrgencyChanged(task: Task, urgency: TaskUrgency): void {
        const current = this.canvasData.getTaskById(task._id as string) ?? task;
        this.canvasData.updateTask({ ...current, urgency })
            .subscribe(result => {
                if (this.selection.isSelected(result._id as string)) {
                    this.selection.updateItem({ type: 'task', item: result });
                }
            });
    }

    onTaskProjectToParentChanged(task: Task, projectToParent: boolean): void {
        const current = this.canvasData.getTaskById(task._id as string) ?? task;
        this.canvasData.updateTask({ ...current, projectToParent })
            .subscribe(result => {
                if (this.selection.isSelected(result._id as string)) {
                    this.selection.updateItem({ type: 'task', item: result });
                }
            });
    }

    onTaskCompleteChanged(task: Task, isComplete: boolean): void {
        const current = this.canvasData.getTaskById(task._id as string) ?? task;
        this.canvasData.updateTask({ ...current, isComplete })
            .subscribe(result => {
                if (this.selection.isSelected(result._id as string)) {
                    this.selection.updateItem({ type: 'task', item: result });
                }
            });
    }

    onProjectedChildCompletionChanged(parent: Task, e: { childId: string; isComplete: boolean }): void {
        this.canvasData.setProjectedChildCompletion(parent._id as string, e.childId, e.isComplete);
    }

    getGroupContainedItems(group: Group): Array<{ id: string; isTask: boolean; layout: Layout }> {
        return this.tasks
            .filter(t => group.itemIds.includes(t._id as string))
            .map(t => ({ id: t._id as string, isTask: true, layout: t.layout }));
    }

    isTaskSelected(task: Task):   boolean { return this.selection.isSelected(task._id  as string); }
    isNoteSelected(note: Note):   boolean { return this.selection.isSelected(note._id  as string); }
    isGroupSelected(group: Group): boolean { return this.selection.isSelected(group._id as string); }

    // --- Drag routing ---

    /**
     * Builds the payload for startMoveMany.
     * Selected groups move with all their contained items.
     * Selected tasks/notes that are inside a selected group are excluded from the
     * independent list (the group's movement already carries them).
     */
    private buildMultiDragPayload(): {
        independentItems: Array<{ id: string; isTask: boolean; layout: Layout }>;
        movingGroups: Array<{ id: string; layout: Layout; containedItems: Array<{ id: string; isTask: boolean; layout: Layout }> }>;
    } {
        const selected = this.selection.selectedItems;
        const selectedGroupIds = new Set(
            selected.filter(s => s.type === 'group').map(s => s.item._id as string)
        );

        const movingGroups = selected
            .filter(s => s.type === 'group')
            .map(s => {
                const g = this.groups.find(gg => (gg._id as any) === (s.item._id as any)) ?? (s.item as Group);
                return { id: g._id as string, layout: g.layout, containedItems: this.getGroupContainedItems(g) };
            });

        const independentItems = selected
            .filter(s => s.type !== 'group')
            .filter(s => {
                if (s.type === 'task') {
                    const groupId = (s.item as any).groupId;
                    return !groupId || !selectedGroupIds.has(groupId as string);
                }
                return true;
            })
            .map(s => {
                if (s.type === 'task') {
                    const t = this.tasks.find(t => (t._id as any) === (s.item._id as any)) ?? (s.item as Task);
                    return { id: t._id as string, isTask: true, layout: t.layout };
                }
                const n = this.notes.find(n => (n._id as any) === (s.item._id as any)) ?? (s.item as Note);
                return { id: n._id as string, isTask: false, layout: n.layout };
            });

        return { independentItems, movingGroups };
    }

    onTaskDragStarted(task: Task, e: PointerEvent): void {
        const isMulti = this.selection.selectedItems.length > 1 && this.selection.isSelected(task._id as string);
        if (isMulti) {
            const { independentItems, movingGroups } = this.buildMultiDragPayload();
            this.interaction.startMoveMany(e, independentItems, movingGroups);
        } else {
            const current = this.tasks.find(t => (t._id as any) === (task._id as any)) ?? task;
            this.interaction.startMove(e, current._id as string, true, current.layout);
        }
    }

    onNoteDragStarted(note: Note, e: PointerEvent): void {
        const isMulti = this.selection.selectedItems.length > 1 && this.selection.isSelected(note._id as string);
        if (isMulti) {
            const { independentItems, movingGroups } = this.buildMultiDragPayload();
            this.interaction.startMoveMany(e, independentItems, movingGroups);
        } else {
            const current = this.notes.find(n => (n._id as any) === (note._id as any)) ?? note;
            this.interaction.startMove(e, current._id as string, false, current.layout);
        }
    }

    onGroupDragStarted(group: Group, e: PointerEvent): void {
        const isMulti = this.selection.selectedItems.length > 1 && this.selection.isSelected(group._id as string);
        if (isMulti) {
            const { independentItems, movingGroups } = this.buildMultiDragPayload();
            this.interaction.startMoveMany(e, independentItems, movingGroups);
        } else {
            const current = this.groups.find(g => (g._id as any) === (group._id as any)) ?? group;
            this.interaction.startMoveGroup(e, current._id as string, current.layout, this.getGroupContainedItems(current));
        }
    }

    // --- Reparent (drop-to-child) & Promote ---

    /** Resolves a list of canvas item ids to a top-level reparent set, dropping tasks that
     *  are members of a group already in the set (the group carries them server-side). */
    private buildReparentSet(ids: string[]): Array<{ id: string; type: 'task' | 'note' | 'group' | 'dashboard' }> {
        const idSet = new Set(ids);
        const selectedGroupIds = new Set(
            this.groups.filter(g => idSet.has(g._id as string)).map(g => g._id as string)
        );
        const result: Array<{ id: string; type: 'task' | 'note' | 'group' | 'dashboard' }> = [];
        for (const id of ids) {
            if (this.groups.some(g => (g._id as string) === id)) { result.push({ id, type: 'group' }); continue; }
            const task = this.tasks.find(t => (t._id as string) === id);
            if (task) {
                const gid = task.groupId;
                if (gid && selectedGroupIds.has(gid)) { continue; }
                result.push({ id, type: 'task' });
                continue;
            }
            if (this.notes.some(n => (n._id as string) === id)) { result.push({ id, type: 'note' }); continue; }
            if (this.dashboards.some(d => (d._id as string) === id)) { result.push({ id, type: 'dashboard' }); continue; }
        }
        return result;
    }

    /** Human-readable summary of a reparent set, e.g. "2 tasks, 1 note". */
    private describeSet(set: Array<{ type: string }>): string {
        const counts: Record<string, number> = {};
        for (const s of set) { counts[s.type] = (counts[s.type] ?? 0) + 1; }
        const parts: string[] = [];
        for (const type of ['task', 'note', 'group', 'dashboard']) {
            const n = counts[type];
            if (n) { parts.push(`${n} ${type}${n !== 1 ? 's' : ''}`); }
        }
        return parts.join(', ') || 'item';
    }

    private handleReparentDrop(targetTaskId: string, draggedIds: string[]): void {
        const set = this.buildReparentSet(draggedIds);
        if (set.length === 0) { return; }
        const target = this.tasks.find(t => (t._id as string) === targetTaskId);
        const targetTitle = target?.title ?? 'task';
        this.confirmation.confirm({
            header:  'Move Items',
            message: `Move ${this.describeSet(set)} to be ${set.length > 1 ? 'children' : 'a child'} of "${targetTitle}"? Their positions are kept.`,
            icon:    'pi pi-sign-in',
            accept:  () => {
                this.canvasData.reparentItems(set, targetTaskId).subscribe(() => this.selection.clear());
            },
            // Reload so any item left at its dropped position (e.g. a dashboard) snaps back.
            reject:  () => this.canvasData.load(),
        });
    }

    onTaskContextMenu(task: Task, e: MouseEvent): void {
        this.contextMenuVisible = false;
        // Right-click selects the task unless it's already part of a multi-selection.
        if (!this.selection.isSelected(task._id as string)) {
            this.selection.select({ type: 'task', item: task });
        }
        // Promote moves items to the parent's parent — only meaningful inside a task workspace.
        if (!this.hostTask) { this.cardMenuVisible = false; return; }
        const count = this.selection.selectedItems.length;
        this.cardMenuItems = [
            { label: count > 1 ? `Promote ${count} items up one level` : 'Promote up one level', icon: 'pi-arrow-up', action: 'promote' },
        ];
        this.cardMenuX = e.clientX;
        this.cardMenuY = e.clientY;
        this.cardMenuVisible = true;
    }

    onCardMenuAction(action: string): void {
        this.cardMenuVisible = false;
        if (action === 'promote') { this.promoteSelected(); }
    }

    private promoteSelected(): void {
        if (!this.hostTask) { return; }
        const newParentTaskId = this.hostTask.parentTaskId ? (this.hostTask.parentTaskId as unknown as string) : null;
        const set = this.buildReparentSet(this.selection.selectedItems.map(s => s.item._id as string));
        if (set.length === 0) { return; }
        const destination = newParentTaskId ? 'the parent task' : 'the project root';
        this.confirmation.confirm({
            header:  'Promote Items',
            message: `Promote ${this.describeSet(set)} out of "${this.hostTask.title}" to ${destination}? Their positions are kept.`,
            icon:    'pi pi-arrow-up',
            accept:  () => {
                this.canvasData.reparentItems(set, newParentTaskId).subscribe(() => this.selection.clear());
            },
        });
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
        if (e.key === 'Shift') { this.shiftHeld = true; return; }
        if (e.key !== 'Delete') { return; }

        const tag = (e.target as HTMLElement).tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement).isContentEditable) { return; }

        const selected = this.selection.selectedItems;
        if (selected.length === 0) { return; }

        const tasks  = selected.filter(s => s.type === 'task').map(s => s.item  as Task);
        const notes  = selected.filter(s => s.type === 'note').map(s => s.item  as Note);
        const groups = selected.filter(s => s.type === 'group').map(s => s.item as Group);

        // Build message that reads naturally for one or many items
        let header: string;
        let message: string;
        if (selected.length === 1) {
            const one = selected[0];
            const name = (one.item as any).title ?? (one.item as any).name ?? '';
            header  = `Delete ${one.type.charAt(0).toUpperCase() + one.type.slice(1)}`;
            message = one.type === 'task'
                ? `Delete "${name}" and all its children? This cannot be undone.`
                : one.type === 'group'
                    ? `Delete "${name}"? Contained tasks will be released back to the canvas.`
                    : `Delete "${name}"? This cannot be undone.`;
        } else {
            const parts: string[] = [];
            if (tasks.length)  { parts.push(`${tasks.length} task${tasks.length  !== 1 ? 's' : ''}`); }
            if (notes.length)  { parts.push(`${notes.length} note${notes.length  !== 1 ? 's' : ''}`); }
            if (groups.length) { parts.push(`${groups.length} group${groups.length !== 1 ? 's' : ''}`); }
            header  = `Delete ${selected.length} Items`;
            message = `Delete ${parts.join(', ')}? This cannot be undone.`;
        }

        this.deletion.confirmDelete(header, message, () => {
            groups.forEach(g => {
                this.canvasData.deleteGroup(g._id as string)
                    .pipe(takeUntil(this.ngDestroy$)).subscribe();
            });
            tasks.forEach(t => {
                this.taskApi.delete(t._id as string).subscribe(() => {
                    this.canvasData.removeTask(t._id as string);
                });
            });
            notes.forEach(n => {
                this.noteApi.delete(n._id as string).subscribe(() => {
                    this.canvasData.removeNote(n._id as string);
                });
            });
        });
    }

    @HostListener('document:keyup', ['$event'])
    onDocumentKeyup(e: KeyboardEvent): void {
        if (e.key === 'Shift') { this.shiftHeld = false; }
    }

    @HostListener('window:blur')
    onWindowBlur(): void {
        this.shiftHeld = false;
    }

    fitAll(): void {
        if (!this.canvasAreaRef) { return; }
        const rect = this.canvasAreaRef.nativeElement.getBoundingClientRect();
        const layouts = [
            ...this.tasks.map(t => t.layout),
            ...this.notes.map(n => n.layout),
            ...this.groups.map(g => g.layout),
            ...this.dashboards.map(d => d.layout),
        ];
        this.viewport.zoomToFit(layouts, rect.width, rect.height);
    }

    get hostDisplayName(): string { return this.hostTask?.title ?? this.hostProject?.name ?? '…'; }
    get isTaskCanvas(): boolean   { return !!this.hostTask; }
}
