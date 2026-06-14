import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subject, forkJoin, of } from 'rxjs';
import { tap, map, catchError, debounceTime, takeUntil } from 'rxjs/operators';
import { SocketService } from './socket.service';
import { TaskApiClient, CreateTaskDto } from './api-clients/task-api.client';
import { NoteApiClient, CreateNoteDto } from './api-clients/note-api.client';
import { ProjectApiClient } from './api-clients/project-api.client';
import { GroupApiClient, CreateGroupDto } from './api-clients/group-api.client';
import { DashboardApiClient, CreateDashboardDto } from './api-clients/dashboard-api.client';
import { Task } from '../../model/shared-models/task.model';
import { Note } from '../../model/shared-models/note.model';
import { Group } from '../../model/shared-models/group.model';
import { Dashboard } from '../../model/shared-models/dashboard.model';
import { Layout } from '../../model/shared-models/layout.model';
import { TaskCounts } from '../../model/shared-models/task-counts.model';
import { TaskUrgency } from '../../model/shared-models/task-urgency.enum';
import { CanvasViewState } from '../../model/shared-models/canvas-view-state.model';
import {
    DEFAULT_ITEM_WIDTH, DEFAULT_ITEM_HEIGHT,
    DEFAULT_GROUP_WIDTH, DEFAULT_GROUP_HEIGHT,
    GROUP_TITLE_HEIGHT, GROUP_PADDING, GROUP_CARD_GAP,
    GROUP_ITEM_HEIGHT, GROUP_ITEM_WIDTH,
    MIN_ITEM_WIDTH, MIN_ITEM_HEIGHT,
} from '../../model/shared-models/canvas-constants';

/** Manages the data (tasks, notes, groups) for one active canvas. Provided per CanvasHostComponent. */
@Injectable()
export class CanvasDataService implements OnDestroy {

    private readonly destroy$ = new Subject<void>();

    constructor() {
        inject(SocketService).dataChanged$
            .pipe(debounceTime(500), takeUntil(this.destroy$))
            .subscribe(() => { if (this.projectId) { this.load(); } });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private readonly taskApi      = inject(TaskApiClient);
    private readonly noteApi      = inject(NoteApiClient);
    private readonly projectApi   = inject(ProjectApiClient);
    private readonly groupApi     = inject(GroupApiClient);
    private readonly dashboardApi = inject(DashboardApiClient);

    private projectId = '';
    private parentTaskId: string | undefined;
    private ancestorTaskIds: string[] = [];

    private readonly tasks$       = new BehaviorSubject<Task[]>([]);
    private readonly notes$       = new BehaviorSubject<Note[]>([]);
    private readonly groups$      = new BehaviorSubject<Group[]>([]);
    private readonly dashboards$  = new BehaviorSubject<Dashboard[]>([]);
    private readonly taskCounts$  = new BehaviorSubject<Record<string, TaskCounts>>({});

    readonly tasks:      Observable<Task[]>                     = this.tasks$.asObservable();
    readonly notes:      Observable<Note[]>                     = this.notes$.asObservable();
    readonly groups:     Observable<Group[]>                    = this.groups$.asObservable();
    readonly dashboards: Observable<Dashboard[]>                = this.dashboards$.asObservable();
    readonly taskCounts: Observable<Record<string, TaskCounts>> = this.taskCounts$.asObservable();

    initialize(projectId: string, parentTaskId: string | undefined, ancestorTaskIds: string[]): void {
        this.projectId       = projectId;
        this.parentTaskId    = parentTaskId;
        this.ancestorTaskIds = ancestorTaskIds;
        this.tasks$.next([]);
        this.notes$.next([]);
        this.groups$.next([]);
        this.dashboards$.next([]);
        this.taskCounts$.next({});
        this.load();
    }

    load(): void {
        const tasks$ = this.parentTaskId
            ? this.taskApi.getByParentTaskWithProjections(this.parentTaskId)
            : this.taskApi.getByProjectWithProjections(this.projectId);

        const notes$ = this.parentTaskId
            ? this.noteApi.getByParentTask(this.parentTaskId)
            : this.noteApi.getByProject(this.projectId);

        const groups$ = (this.parentTaskId
            ? this.groupApi.getByParentTask(this.parentTaskId)
            : this.groupApi.getByProject(this.projectId)
        ).pipe(catchError(() => of<Group[]>([])));

        const dashboards$ = (this.parentTaskId
            ? this.dashboardApi.getByParentTask(this.parentTaskId)
            : this.dashboardApi.getByProject(this.projectId)
        ).pipe(catchError(() => of<Dashboard[]>([])));

        forkJoin([tasks$, notes$, groups$, dashboards$]).subscribe(([tasks, notes, groups, dashboards]) => {
            this.tasks$.next(tasks);
            this.notes$.next(notes);
            this.groups$.next(groups);
            this.dashboards$.next(dashboards);
            const taskIds = tasks.map(t => (t._id as any).toString());
            if (taskIds.length > 0) {
                this.taskApi.getCounts(taskIds).subscribe(counts => this.taskCounts$.next(counts));
            } else {
                this.taskCounts$.next({});
            }
        });
    }

    addTask(canvasX: number, canvasY: number): Observable<Task> {
        const dto: CreateTaskDto = {
            projectId:       this.projectId,
            parentTaskId:    this.parentTaskId,
            ancestorTaskIds: this.ancestorTaskIds,
            title:           'New Task',
            description:     '',
            urgency:         TaskUrgency.Normal,
            isComplete:      false,
            layout:          { x: canvasX, y: canvasY, width: DEFAULT_ITEM_WIDTH, height: DEFAULT_ITEM_HEIGHT, zIndex: Date.now() },
        };
        return this.taskApi.create(dto).pipe(
            tap(task => this.tasks$.next([...this.tasks$.getValue(), task]))
        );
    }

    addNote(canvasX: number, canvasY: number): Observable<Note> {
        const dto: CreateNoteDto = {
            projectId:       this.projectId,
            parentTaskId:    this.parentTaskId,
            ancestorTaskIds: this.ancestorTaskIds,
            title:           'New Note',
            details:         '',
            backgroundColor: '#fdf2c4',
            layout:          { x: canvasX, y: canvasY, width: DEFAULT_ITEM_WIDTH, height: DEFAULT_ITEM_HEIGHT, zIndex: Date.now() },
        };
        return this.noteApi.create(dto).pipe(
            tap(note => this.notes$.next([...this.notes$.getValue(), note]))
        );
    }

    addGroup(canvasX: number, canvasY: number): Observable<Group> {
        const dto: CreateGroupDto = {
            projectId:       this.projectId,
            parentTaskId:    this.parentTaskId,
            title:           'Group',
            layout:          { x: canvasX, y: canvasY, width: DEFAULT_GROUP_WIDTH, height: DEFAULT_GROUP_HEIGHT, zIndex: 1 },
            itemIds:         [],
            layoutDirection: 'vertical',
            layoutWrap:      false,
        };
        return this.groupApi.create(dto).pipe(
            tap(group => this.groups$.next([...this.groups$.getValue(), group]))
        );
    }

    updateTaskLayout(taskId: string, layout: Layout): void {
        const current = this.tasks$.getValue().find(t => t._id === taskId);
        const merged  = current ? { ...layout, zIndex: current.layout.zIndex } : layout;
        this.tasks$.next(this.tasks$.getValue().map(t => t._id === taskId ? { ...t, layout: merged } : t));
        this.taskApi.update(taskId, { layout: merged }).subscribe();
    }

    updateNoteLayout(noteId: string, layout: Layout): void {
        const current = this.notes$.getValue().find(n => n._id === noteId);
        const merged  = current ? { ...layout, zIndex: current.layout.zIndex } : layout;
        this.notes$.next(this.notes$.getValue().map(n => n._id === noteId ? { ...n, layout: merged } : n));
        this.noteApi.update(noteId, { layout: merged }).subscribe();
    }

    updateGroupLayout(groupId: string, layout: Layout): void {
        this.groups$.next(this.groups$.getValue().map(g => (g._id as any) === groupId ? { ...g, layout } : g));
        this.groupApi.update(groupId, { layout }).subscribe();
    }

    getTaskById(id: string): Task | undefined {
        return this.tasks$.getValue().find(t => t._id === id);
    }

    getNoteById(id: string): Note | undefined {
        return this.notes$.getValue().find(n => n._id === id);
    }

    updateTask(task: Task): Observable<Task> {
        const id = task._id as any;
        this.tasks$.next(this.tasks$.getValue().map(t => (t._id as any) === id ? task : t));
        return this.taskApi.update(task._id as string, task).pipe(
            tap(serverResult => {
                const existing = this.tasks$.getValue().find(t => (t._id as any) === (serverResult._id as any));
                const merged = { ...serverResult, projectedChildren: existing?.projectedChildren };
                this.tasks$.next(this.tasks$.getValue().map(t => (t._id as any) === (serverResult._id as any) ? merged : t));
            })
        );
    }

    /**
     * Toggles a projected child's completion from the parent card's list. The child
     * task lives on this parent's own canvas (not loaded here), so we persist it
     * directly and optimistically patch the parent's embedded projectedChildren
     * copy so the strike-through appears immediately.
     */
    setProjectedChildCompletion(parentId: string, childId: string, isComplete: boolean): void {
        this.tasks$.next(this.tasks$.getValue().map(t => {
            if ((t._id as any) !== parentId) { return t; }
            const projectedChildren = (t.projectedChildren ?? []).map(c =>
                (c._id as any) === childId ? { ...c, isComplete } : c);
            return { ...t, projectedChildren };
        }));
        this.taskApi.update(childId, { isComplete }).subscribe();
    }

    addDashboard(canvasX: number, canvasY: number, title: string, key: string): Observable<Dashboard> {
        const dto: CreateDashboardDto = {
            projectId:       this.projectId,
            parentTaskId:    this.parentTaskId,
            ancestorTaskIds: this.ancestorTaskIds,
            title,
            key,
            layout: { x: canvasX, y: canvasY, width: DEFAULT_ITEM_WIDTH * 1.5, height: DEFAULT_ITEM_HEIGHT * 2, zIndex: Date.now() },
            config: { widgets: [] },
        };
        return this.dashboardApi.create(dto).pipe(
            tap(dashboard => this.dashboards$.next([...this.dashboards$.getValue(), dashboard]))
        );
    }

    updateDashboard(dashboard: Dashboard): Observable<Dashboard> {
        const id = dashboard._id as any;
        this.dashboards$.next(this.dashboards$.getValue().map(d => (d._id as any) === id ? dashboard : d));
        return this.dashboardApi.update(dashboard._id as string, dashboard).pipe(
            tap(updated => this.dashboards$.next(
                this.dashboards$.getValue().map(d => (d._id as any) === (updated._id as any) ? updated : d)
            ))
        );
    }

    updateDashboardLayout(dashboardId: string, layout: Layout): void {
        this.dashboards$.next(
            this.dashboards$.getValue().map(d => (d._id as any) === dashboardId ? { ...d, layout } : d)
        );
        this.dashboardApi.update(dashboardId, { layout }).subscribe();
    }

    removeDashboard(dashboardId: string): void {
        this.dashboards$.next(this.dashboards$.getValue().filter(d => (d._id as any) !== dashboardId));
    }

    getDashboardById(id: string): Dashboard | undefined {
        return this.dashboards$.getValue().find(d => (d._id as any) === id);
    }

    updateNote(note: Note): Observable<Note> {
        return this.noteApi.update(note._id as string, note).pipe(
            tap(updated => this.notes$.next(this.notes$.getValue().map(n => n._id === updated._id ? updated : n)))
        );
    }

    updateGroupTitle(groupId: string, title: string): void {
        this.groups$.next(this.groups$.getValue().map(g => (g._id as any) === groupId ? { ...g, title } : g));
        this.groupApi.update(groupId, { title }).subscribe();
    }

    removeTask(taskId: string): void {
        const task = this.tasks$.getValue().find(t => (t._id as any) === taskId);
        this.tasks$.next(this.tasks$.getValue().filter(t => (t._id as any) !== taskId));

        if (!task?.groupId) { return; }

        const groupId = task.groupId as string;
        const group   = this.groups$.getValue().find(g => (g._id as any) === groupId);
        if (!group) { return; }

        const newItemIds     = group.itemIds.filter(id => id !== taskId);
        const remainingTasks = newItemIds
            .map(id => this.tasks$.getValue().find(t => (t._id as any) === id))
            .filter((t): t is Task => !!t);

        const { itemLayouts, groupLayout } = this.computeGroupLayout(
            { ...group, itemIds: newItemIds }, remainingTasks);
        const updatedGroup    = { ...group, itemIds: newItemIds, layout: groupLayout };
        const relayoutedTasks = remainingTasks.map((t, i) => ({ ...t, layout: itemLayouts[i] }));

        this.groups$.next(this.groups$.getValue().map(g => (g._id as any) === groupId ? updatedGroup : g));
        this.tasks$.next(this.tasks$.getValue().map(t => {
            const r = relayoutedTasks.find(rt => (rt._id as any) === (t._id as any));
            return r ?? t;
        }));

        this.groupApi.update(groupId, { itemIds: newItemIds, layout: groupLayout }).subscribe();
        relayoutedTasks.forEach(t => this.taskApi.update(t._id as string, { layout: t.layout }).subscribe());
    }

    removeNote(noteId: string): void {
        this.notes$.next(this.notes$.getValue().filter(n => n._id !== noteId));
    }

    saveViewState(hostId: string, isProject: boolean, viewState: CanvasViewState): void {
        if (isProject) {
            this.projectApi.update(hostId, { viewState }).subscribe();
        } else {
            this.taskApi.update(hostId, { viewState }).subscribe();
        }
    }

    bringToFront(id: string, isTask: boolean): void {
        const zIndex = Date.now();
        if (isTask) {
            const tasks = this.tasks$.getValue();
            const task = tasks.find(t => t._id === id);
            if (task && !task.groupId) {
                const updated = { ...task, layout: { ...task.layout, zIndex } };
                this.tasks$.next(tasks.map(t => t._id === id ? updated : t));
                this.taskApi.update(id, { layout: updated.layout }).subscribe();
            }
        } else {
            const notes = this.notes$.getValue();
            const note = notes.find(n => n._id === id);
            if (note) {
                const updated = { ...note, layout: { ...note.layout, zIndex } };
                this.notes$.next(notes.map(n => n._id === id ? updated : n));
                this.noteApi.update(id, { layout: updated.layout }).subscribe();
            }
        }
    }

    bringGroupToFront(groupId: string): void {
        const groups = this.groups$.getValue();
        const group = groups.find(g => (g._id as any) === groupId);
        if (!group) { return; }
        const zIndex = (Date.now() % 100000) + 1;
        const updated = { ...group, layout: { ...group.layout, zIndex } };
        this.groups$.next(groups.map(g => (g._id as any) === groupId ? updated : g));
        this.groupApi.update(groupId, { layout: updated.layout }).subscribe();
    }

    // --- Group membership management ---

    /**
     * Unified layout engine. Returns the auto-computed group layout and the
     * absolute Layout for each task. `resizeOverride` carries the user-dragged
     * dimensions; the auto dimension (height for vertical/wrap, width for
     * horizontal-no-wrap) is always replaced with the computed value.
     */
    private computeGroupLayout(
        group: Group,
        tasks: Task[],
        resizeOverride?: Layout,
    ): { itemLayouts: Layout[]; groupLayout: Layout } {
        const dir  = group.layoutDirection ?? 'vertical';
        const wrap = group.layoutWrap ?? false;
        const n    = tasks.length;

        // Apply user-controlled dimension from resize, leave the auto-dimension alone
        let base = { ...group.layout };
        if (resizeOverride) {
            if (dir === 'horizontal' && !wrap) {
                // N/S resize → user controls height
                base = { ...base, x: resizeOverride.x, y: resizeOverride.y, height: resizeOverride.height };
            } else {
                // E/W resize → user controls width
                base = { ...base, x: resizeOverride.x, y: resizeOverride.y, width: resizeOverride.width };
            }
        }

        if (dir === 'vertical') {
            const height = n === 0 ? DEFAULT_GROUP_HEIGHT
                : GROUP_TITLE_HEIGHT + 2 * GROUP_PADDING + n * GROUP_ITEM_HEIGHT + (n - 1) * GROUP_CARD_GAP;
            const cardWidth = Math.max(MIN_ITEM_WIDTH, base.width - 2 * GROUP_PADDING);
            const groupLayout = { ...base, height };
            const itemLayouts = tasks.map((_, i) => ({
                x:      base.x + GROUP_PADDING,
                y:      base.y + GROUP_TITLE_HEIGHT + GROUP_PADDING + i * (GROUP_ITEM_HEIGHT + GROUP_CARD_GAP),
                width:  cardWidth,
                height: GROUP_ITEM_HEIGHT,
                zIndex: base.zIndex + 1 + i,
            }));
            return { itemLayouts, groupLayout };
        }

        if (!wrap) {
            // Horizontal no-wrap: width is auto, height is user-controlled
            const cardHeight = Math.max(MIN_ITEM_HEIGHT, base.height - GROUP_TITLE_HEIGHT - 2 * GROUP_PADDING);
            const width = n === 0 ? DEFAULT_GROUP_WIDTH
                : 2 * GROUP_PADDING + n * GROUP_ITEM_WIDTH + (n - 1) * GROUP_CARD_GAP;
            const groupLayout = { ...base, width };
            const itemLayouts = tasks.map((_, i) => ({
                x:      base.x + GROUP_PADDING + i * (GROUP_ITEM_WIDTH + GROUP_CARD_GAP),
                y:      base.y + GROUP_TITLE_HEIGHT + GROUP_PADDING,
                width:  GROUP_ITEM_WIDTH,
                height: cardHeight,
                zIndex: base.zIndex + 1 + i,
            }));
            return { itemLayouts, groupLayout };
        }

        // Horizontal wrap: width is user-controlled, height is auto from row count
        const itemsPerRow = Math.max(1,
            Math.floor((base.width - 2 * GROUP_PADDING + GROUP_CARD_GAP) / (GROUP_ITEM_WIDTH + GROUP_CARD_GAP)));
        const numRows  = n === 0 ? 0 : Math.ceil(n / itemsPerRow);
        const height   = n === 0 ? DEFAULT_GROUP_HEIGHT
            : GROUP_TITLE_HEIGHT + 2 * GROUP_PADDING + numRows * GROUP_ITEM_HEIGHT + Math.max(0, numRows - 1) * GROUP_CARD_GAP;
        const groupLayout = { ...base, height };
        const itemLayouts = tasks.map((_, i) => {
            const row = Math.floor(i / itemsPerRow);
            const col = i % itemsPerRow;
            return {
                x:      base.x + GROUP_PADDING + col * (GROUP_ITEM_WIDTH + GROUP_CARD_GAP),
                y:      base.y + GROUP_TITLE_HEIGHT + GROUP_PADDING + row * (GROUP_ITEM_HEIGHT + GROUP_CARD_GAP),
                width:  GROUP_ITEM_WIDTH,
                height: GROUP_ITEM_HEIGHT,
                zIndex: base.zIndex + 1 + i,
            };
        });
        return { itemLayouts, groupLayout };
    }

    enterGroup(taskId: string, groupId: string, orderedItemIds?: string[]): Observable<{ updatedTasks: Task[]; updatedGroup: Group }> {
        const task  = this.tasks$.getValue().find(t => (t._id as any) === taskId);
        const group = this.groups$.getValue().find(g => (g._id as any) === groupId);
        if (!task || !group) { return of({ updatedTasks: [], updatedGroup: group! }); }

        const preGroupLayout = task.preGroupLayout ?? { ...task.layout };
        const computedIds = orderedItemIds ?? [...group.itemIds.filter(id => id !== taskId), taskId];
        const allTasks    = this.tasks$.getValue();
        const groupTasks: Task[] = computedIds.map(id => {
            if (id === taskId) { return { ...task, groupId, preGroupLayout }; }
            return allTasks.find(t => (t._id as any) === id)!;
        }).filter(Boolean);

        const { itemLayouts, groupLayout } = this.computeGroupLayout(
            { ...group, itemIds: computedIds }, groupTasks);
        const updatedGroup: Group = { ...group, itemIds: computedIds, layout: groupLayout };
        const updatedTasks = groupTasks.map((t, i) => ({ ...t, layout: itemLayouts[i] }));

        this.tasks$.next(allTasks.map(t => {
            const u = updatedTasks.find(ut => (ut._id as any) === (t._id as any));
            return u ?? t;
        }));
        this.groups$.next(this.groups$.getValue().map(g => (g._id as any) === groupId ? updatedGroup : g));

        return forkJoin([
            this.groupApi.update(groupId, { itemIds: computedIds, layout: groupLayout }),
            ...updatedTasks.map(t => this.taskApi.update(t._id as string, {
                layout: t.layout,
                groupId: (t as any).groupId ?? null,
                preGroupLayout: (t as any).preGroupLayout ?? null,
            })),
        ]).pipe(map(() => ({ updatedTasks, updatedGroup })));
    }

    exitGroup(taskId: string, groupId: string, droppedLayout: Layout): Observable<{
        updatedTask: Task;
        updatedGroup: Group;
        relayoutedTasks: Task[];
    }> {
        const task  = this.tasks$.getValue().find(t => (t._id as any) === taskId);
        const group = this.groups$.getValue().find(g => (g._id as any) === groupId);
        if (!task || !group) { return of({ updatedTask: task!, updatedGroup: group!, relayoutedTasks: [] }); }

        const preLayout   = task.preGroupLayout ?? droppedLayout;
        const exitLayout: Layout = {
            x:      droppedLayout.x,
            y:      droppedLayout.y,
            width:  preLayout.width,
            height: preLayout.height,
            zIndex: Date.now(),
        };

        const { groupId: _gid, preGroupLayout: _pgl, ...taskRest } = task as any;
        const updatedTask: Task = { ...taskRest, layout: exitLayout };

        const newItemIds     = group.itemIds.filter(id => id !== taskId);
        const allTasks       = this.tasks$.getValue();
        const remainingTasks = newItemIds.map(id => allTasks.find(t => (t._id as any) === id)!).filter(Boolean);

        const { itemLayouts, groupLayout } = this.computeGroupLayout(
            { ...group, itemIds: newItemIds }, remainingTasks);
        const updatedGroup    = { ...group, itemIds: newItemIds, layout: groupLayout };
        const relayoutedTasks = remainingTasks.map((t, i) => ({ ...t, layout: itemLayouts[i] }));

        this.tasks$.next(allTasks.map(t => {
            if ((t._id as any) === taskId) { return updatedTask; }
            const r = relayoutedTasks.find(rt => (rt._id as any) === (t._id as any));
            return r ?? t;
        }));
        this.groups$.next(this.groups$.getValue().map(g => (g._id as any) === groupId ? updatedGroup : g));

        return forkJoin([
            this.groupApi.update(groupId, { itemIds: newItemIds, layout: groupLayout }),
            this.taskApi.update(taskId, { layout: exitLayout, groupId: null, preGroupLayout: null }),
            ...relayoutedTasks.map(t => this.taskApi.update(t._id as string, { layout: t.layout })),
        ]).pipe(map(() => ({ updatedTask, updatedGroup, relayoutedTasks })));
    }

    moveTaskBetweenGroups(taskId: string, fromGroupId: string, toGroupId: string, newToItemIds?: string[]): Observable<{
        updatedTasks: Task[];
        updatedGroups: Group[];
    }> {
        const task      = this.tasks$.getValue().find(t => (t._id as any) === taskId);
        const fromGroup = this.groups$.getValue().find(g => (g._id as any) === fromGroupId);
        const toGroup   = this.groups$.getValue().find(g => (g._id as any) === toGroupId);
        if (!task || !fromGroup || !toGroup) { return of({ updatedTasks: [], updatedGroups: [] }); }

        const fromItemIds = fromGroup.itemIds.filter(id => id !== taskId);
        const toItemIds   = newToItemIds ?? [...toGroup.itemIds.filter(id => id !== taskId), taskId];

        const allTasks    = this.tasks$.getValue();
        const movedTask: Task = { ...task, groupId: toGroupId };

        const toTasks: Task[] = toItemIds.map(id =>
            id === taskId ? movedTask : (allTasks.find(t => (t._id as any) === id)!)
        ).filter(Boolean);
        const fromTasks = fromItemIds.map(id => allTasks.find(t => (t._id as any) === id)!).filter(Boolean);

        const { itemLayouts: toLayouts,   groupLayout: toLayout   } = this.computeGroupLayout({ ...toGroup,   itemIds: toItemIds   }, toTasks);
        const { itemLayouts: fromLayouts, groupLayout: fromLayout  } = this.computeGroupLayout({ ...fromGroup, itemIds: fromItemIds }, fromTasks);

        const updFromGroup: Group = { ...fromGroup, itemIds: fromItemIds, layout: fromLayout };
        const updToGroup:   Group = { ...toGroup,   itemIds: toItemIds,   layout: toLayout   };

        const updatedToTasks   = toTasks.map((t, i)   => ({ ...t, layout: toLayouts[i]   }));
        const updatedFromTasks = fromTasks.map((t, i)  => ({ ...t, layout: fromLayouts[i] }));
        const allUpdated       = [...updatedToTasks, ...updatedFromTasks];

        this.tasks$.next(allTasks.map(t => {
            const u = allUpdated.find(ut => (ut._id as any) === (t._id as any));
            return u ?? t;
        }));
        this.groups$.next(this.groups$.getValue().map(g => {
            if ((g._id as any) === fromGroupId) { return updFromGroup; }
            if ((g._id as any) === toGroupId)   { return updToGroup; }
            return g;
        }));

        return forkJoin([
            this.groupApi.update(fromGroupId, { itemIds: fromItemIds, layout: updFromGroup.layout }),
            this.groupApi.update(toGroupId,   { itemIds: toItemIds,   layout: updToGroup.layout   }),
            ...allUpdated.map(t => this.taskApi.update(t._id as string, {
                layout: t.layout,
                groupId: (t as any).groupId ?? null,
            })),
        ]).pipe(map(() => ({ updatedTasks: allUpdated, updatedGroups: [updFromGroup, updToGroup] })));
    }

    reorderGroup(groupId: string, newItemIds: string[], currentTasks: Task[]): Observable<Task[]> {
        const existing = this.groups$.getValue().find(g => (g._id as any) === groupId);
        if (!existing) { return of([]); }

        const groupTasks = newItemIds
            .map(id => currentTasks.find(t => (t._id as any) === id))
            .filter((t): t is Task => !!t);

        const updatedGroupRef = { ...existing, itemIds: newItemIds };
        const { itemLayouts, groupLayout } = this.computeGroupLayout(updatedGroupRef, groupTasks);
        const finalGroup = { ...updatedGroupRef, layout: groupLayout };

        this.groups$.next(this.groups$.getValue().map(g => (g._id as any) === groupId ? finalGroup : g));

        if (groupTasks.length === 0) {
            return this.groupApi.update(groupId, { itemIds: newItemIds, layout: groupLayout }).pipe(map(() => []));
        }

        const updatedTasks = groupTasks.map((t, i) => ({ ...t, layout: itemLayouts[i] }));
        this.tasks$.next(this.tasks$.getValue().map(t => {
            const u = updatedTasks.find(ut => (ut._id as any) === (t._id as any));
            return u ?? t;
        }));

        return forkJoin([
            this.groupApi.update(groupId, { itemIds: newItemIds, layout: groupLayout }),
            ...updatedTasks.map(t => this.taskApi.update(t._id as string, { layout: t.layout })),
        ]).pipe(map(() => updatedTasks));
    }

    relayoutGroup(groupId: string, currentTasks: Task[], resizeLayout?: Layout): Observable<Task[]> {
        const existing = this.groups$.getValue().find(g => (g._id as any) === groupId);
        if (!existing) { return of([]); }

        const groupTasks = existing.itemIds
            .map(id => currentTasks.find(t => (t._id as any) === id))
            .filter((t): t is Task => !!t);

        const { itemLayouts, groupLayout } = this.computeGroupLayout(existing, groupTasks, resizeLayout);
        const group = { ...existing, layout: groupLayout };

        this.groups$.next(this.groups$.getValue().map(g => (g._id as any) === groupId ? group : g));

        if (groupTasks.length === 0) {
            return this.groupApi.update(groupId, { layout: groupLayout }).pipe(map(() => []));
        }

        const updatedTasks = groupTasks.map((t, i) => ({ ...t, layout: itemLayouts[i] }));

        this.tasks$.next(this.tasks$.getValue().map(t => {
            const u = updatedTasks.find(ut => (ut._id as any) === (t._id as any));
            return u ?? t;
        }));

        return forkJoin([
            this.groupApi.update(groupId, { layout: groupLayout }),
            ...updatedTasks.map(t => this.taskApi.update(t._id as string, { layout: t.layout })),
        ]).pipe(map(() => updatedTasks));
    }

    updateGroupLayoutConfig(
        groupId: string,
        direction: 'vertical' | 'horizontal',
        wrap: boolean,
        currentTasks: Task[],
    ): Observable<Task[]> {
        const existing = this.groups$.getValue().find(g => (g._id as any) === groupId);
        if (!existing) { return of([]); }

        // When switching TO horizontal no-wrap, seed a sensible starting height if the
        // current height looks like it was auto-computed for vertical layout.
        let baseGroup = { ...existing, layoutDirection: direction as 'vertical' | 'horizontal', layoutWrap: wrap };
        if (direction === 'horizontal' && !wrap) {
            const minH = GROUP_TITLE_HEIGHT + MIN_ITEM_HEIGHT + 2 * GROUP_PADDING;
            const sensibleH = GROUP_TITLE_HEIGHT + GROUP_ITEM_HEIGHT + 2 * GROUP_PADDING;
            if (existing.layout.height < minH || existing.layoutDirection !== 'horizontal') {
                baseGroup = { ...baseGroup, layout: { ...existing.layout, height: sensibleH } };
            }
        }

        const groupTasks = existing.itemIds
            .map(id => currentTasks.find(t => (t._id as any) === id))
            .filter((t): t is Task => !!t);

        const { itemLayouts, groupLayout } = this.computeGroupLayout(baseGroup, groupTasks);
        const updatedGroup = { ...baseGroup, layout: groupLayout };

        this.groups$.next(this.groups$.getValue().map(g => (g._id as any) === groupId ? updatedGroup : g));

        if (groupTasks.length === 0) {
            return this.groupApi.update(groupId, {
                layoutDirection: direction, layoutWrap: wrap, layout: groupLayout,
            }).pipe(map(() => []));
        }

        const updatedTasks = groupTasks.map((t, i) => ({ ...t, layout: itemLayouts[i] }));
        this.tasks$.next(this.tasks$.getValue().map(t => {
            const u = updatedTasks.find(ut => (ut._id as any) === (t._id as any));
            return u ?? t;
        }));

        return forkJoin([
            this.groupApi.update(groupId, { layoutDirection: direction, layoutWrap: wrap, layout: groupLayout }),
            ...updatedTasks.map(t => this.taskApi.update(t._id as string, { layout: t.layout })),
        ]).pipe(map(() => updatedTasks));
    }

    deleteGroup(groupId: string): Observable<void> {
        const group = this.groups$.getValue().find(g => (g._id as any) === groupId);
        if (!group) { return of(undefined); }

        const allTasks   = this.tasks$.getValue();
        const groupTasks = group.itemIds
            .map(id => allTasks.find(t => (t._id as any) === id))
            .filter((t): t is Task => !!t);

        const releasedTasks = groupTasks.map(t => {
            const { groupId: _g, preGroupLayout: _p, ...rest } = t as any;
            return { ...rest, layout: t.preGroupLayout ?? t.layout, zIndex: Date.now() } as Task;
        });

        this.tasks$.next(allTasks.map(t => {
            const r = releasedTasks.find(rt => (rt._id as any) === (t._id as any));
            return r ?? t;
        }));
        this.groups$.next(this.groups$.getValue().filter(g => (g._id as any) !== groupId));

        const persists: Observable<any>[] = [
            this.groupApi.delete(groupId),
            ...releasedTasks.map(t => this.taskApi.update(t._id as string, {
                layout: t.layout, groupId: null, preGroupLayout: null,
            })),
        ];
        return forkJoin(persists.length > 0 ? persists : [of(null)]).pipe(map(() => undefined));
    }
}
