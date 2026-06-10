import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, forkJoin, of } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';
import { TaskApiClient, CreateTaskDto } from './api-clients/task-api.client';
import { NoteApiClient, CreateNoteDto } from './api-clients/note-api.client';
import { ProjectApiClient } from './api-clients/project-api.client';
import { GroupApiClient, CreateGroupDto } from './api-clients/group-api.client';
import { Task } from '../../model/shared-models/task.model';
import { Note } from '../../model/shared-models/note.model';
import { Group } from '../../model/shared-models/group.model';
import { Layout } from '../../model/shared-models/layout.model';
import { TaskCounts } from '../../model/shared-models/task-counts.model';
import { TaskUrgency } from '../../model/shared-models/task-urgency.enum';
import { CanvasViewState } from '../../model/shared-models/canvas-view-state.model';
import {
    DEFAULT_ITEM_WIDTH, DEFAULT_ITEM_HEIGHT,
    DEFAULT_GROUP_WIDTH, DEFAULT_GROUP_HEIGHT,
    GROUP_TITLE_HEIGHT, GROUP_PADDING, GROUP_CARD_GAP, GROUP_ITEM_HEIGHT,
    MIN_ITEM_WIDTH,
} from '../../model/shared-models/canvas-constants';

/** Manages the data (tasks, notes, groups) for one active canvas. Provided per CanvasHostComponent. */
@Injectable()
export class CanvasDataService {

    constructor() { }

    private readonly taskApi    = inject(TaskApiClient);
    private readonly noteApi    = inject(NoteApiClient);
    private readonly projectApi = inject(ProjectApiClient);
    private readonly groupApi   = inject(GroupApiClient);

    private projectId = '';
    private parentTaskId: string | undefined;
    private ancestorTaskIds: string[] = [];

    private readonly tasks$       = new BehaviorSubject<Task[]>([]);
    private readonly notes$       = new BehaviorSubject<Note[]>([]);
    private readonly groups$      = new BehaviorSubject<Group[]>([]);
    private readonly taskCounts$  = new BehaviorSubject<Record<string, TaskCounts>>({});

    readonly tasks:      Observable<Task[]>                     = this.tasks$.asObservable();
    readonly notes:      Observable<Note[]>                     = this.notes$.asObservable();
    readonly groups:     Observable<Group[]>                    = this.groups$.asObservable();
    readonly taskCounts: Observable<Record<string, TaskCounts>> = this.taskCounts$.asObservable();

    initialize(projectId: string, parentTaskId: string | undefined, ancestorTaskIds: string[]): void {
        this.projectId       = projectId;
        this.parentTaskId    = parentTaskId;
        this.ancestorTaskIds = ancestorTaskIds;
        this.tasks$.next([]);
        this.notes$.next([]);
        this.groups$.next([]);
        this.taskCounts$.next({});
        this.load();
    }

    load(): void {
        const tasks$ = this.parentTaskId
            ? this.taskApi.getByParentTask(this.parentTaskId)
            : this.taskApi.getByProject(this.projectId);

        const notes$ = this.parentTaskId
            ? this.noteApi.getByParentTask(this.parentTaskId)
            : this.noteApi.getByProject(this.projectId);

        const groups$ = (this.parentTaskId
            ? this.groupApi.getByParentTask(this.parentTaskId)
            : this.groupApi.getByProject(this.projectId)
        ).pipe(catchError(() => of<Group[]>([])));

        forkJoin([tasks$, notes$, groups$]).subscribe(([tasks, notes, groups]) => {
            this.tasks$.next(tasks);
            this.notes$.next(notes);
            this.groups$.next(groups);
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
            projectId:    this.projectId,
            parentTaskId: this.parentTaskId,
            title:        'Group',
            layout:       { x: canvasX, y: canvasY, width: DEFAULT_GROUP_WIDTH, height: DEFAULT_GROUP_HEIGHT, zIndex: 1 },
            itemIds:      [],
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
        return this.taskApi.update(task._id as string, task).pipe(
            tap(updated => this.tasks$.next(this.tasks$.getValue().map(t => t._id === updated._id ? updated : t)))
        );
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
        this.tasks$.next(this.tasks$.getValue().filter(t => t._id !== taskId));
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

    private computeGroupItemLayouts(group: Group, tasks: Task[]): Layout[] {
        const n = tasks.length;
        if (n === 0) { return []; }
        const cardWidth = Math.max(MIN_ITEM_WIDTH, group.layout.width - 2 * GROUP_PADDING);
        return tasks.map((_, i) => ({
            x:      group.layout.x + GROUP_PADDING,
            y:      group.layout.y + GROUP_TITLE_HEIGHT + GROUP_PADDING + i * (GROUP_ITEM_HEIGHT + GROUP_CARD_GAP),
            width:  cardWidth,
            height: GROUP_ITEM_HEIGHT,
            zIndex: group.layout.zIndex + 1 + i,
        }));
    }

    private computeMinGroupHeight(itemCount: number): number {
        if (itemCount === 0) { return DEFAULT_GROUP_HEIGHT; }
        return GROUP_TITLE_HEIGHT + 2 * GROUP_PADDING
            + itemCount * GROUP_ITEM_HEIGHT
            + (itemCount - 1) * GROUP_CARD_GAP;
    }

    enterGroup(taskId: string, groupId: string): Observable<{ updatedTasks: Task[]; updatedGroup: Group }> {
        const task  = this.tasks$.getValue().find(t => (t._id as any) === taskId);
        const group = this.groups$.getValue().find(g => (g._id as any) === groupId);
        if (!task || !group) { return of({ updatedTasks: [], updatedGroup: group! }); }

        const preGroupLayout = task.preGroupLayout ?? { ...task.layout };
        const newItemIds = [...group.itemIds.filter(id => id !== taskId), taskId];
        const newGroupLayout = { ...group.layout, height: this.computeMinGroupHeight(newItemIds.length) };
        const updatedGroup: Group = { ...group, itemIds: newItemIds, layout: newGroupLayout };

        const allTasks = this.tasks$.getValue();
        const groupTasks: Task[] = newItemIds.map(id => {
            if (id === taskId) { return { ...task, groupId, preGroupLayout }; }
            return allTasks.find(t => (t._id as any) === id)!;
        }).filter(Boolean);

        const layouts = this.computeGroupItemLayouts(updatedGroup, groupTasks);
        const updatedTasks = groupTasks.map((t, i) => ({ ...t, layout: layouts[i] }));

        this.tasks$.next(allTasks.map(t => {
            const u = updatedTasks.find(ut => (ut._id as any) === (t._id as any));
            return u ?? t;
        }));
        this.groups$.next(this.groups$.getValue().map(g => (g._id as any) === groupId ? updatedGroup : g));

        return forkJoin([
            this.groupApi.update(groupId, { itemIds: newItemIds, layout: newGroupLayout }),
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
        const newGroupLayout = { ...group.layout, height: this.computeMinGroupHeight(newItemIds.length) };
        const updatedGroup   = { ...group, itemIds: newItemIds, layout: newGroupLayout };

        const allTasks        = this.tasks$.getValue();
        const remainingTasks  = newItemIds.map(id => allTasks.find(t => (t._id as any) === id)!).filter(Boolean);
        const layouts         = this.computeGroupItemLayouts(updatedGroup, remainingTasks);
        const relayoutedTasks = remainingTasks.map((t, i) => ({ ...t, layout: layouts[i] }));

        this.tasks$.next(allTasks.map(t => {
            if ((t._id as any) === taskId) { return updatedTask; }
            const r = relayoutedTasks.find(rt => (rt._id as any) === (t._id as any));
            return r ?? t;
        }));
        this.groups$.next(this.groups$.getValue().map(g => (g._id as any) === groupId ? updatedGroup : g));

        return forkJoin([
            this.groupApi.update(groupId, { itemIds: newItemIds, layout: newGroupLayout }),
            this.taskApi.update(taskId, { layout: exitLayout, groupId: null, preGroupLayout: null }),
            ...relayoutedTasks.map(t => this.taskApi.update(t._id as string, { layout: t.layout })),
        ]).pipe(map(() => ({ updatedTask, updatedGroup, relayoutedTasks })));
    }

    moveTaskBetweenGroups(taskId: string, fromGroupId: string, toGroupId: string): Observable<{
        updatedTasks: Task[];
        updatedGroups: Group[];
    }> {
        const task      = this.tasks$.getValue().find(t => (t._id as any) === taskId);
        const fromGroup = this.groups$.getValue().find(g => (g._id as any) === fromGroupId);
        const toGroup   = this.groups$.getValue().find(g => (g._id as any) === toGroupId);
        if (!task || !fromGroup || !toGroup) { return of({ updatedTasks: [], updatedGroups: [] }); }

        const fromItemIds = fromGroup.itemIds.filter(id => id !== taskId);
        const toItemIds   = [...toGroup.itemIds.filter(id => id !== taskId), taskId];
        const updFromGroup: Group = { ...fromGroup, itemIds: fromItemIds, layout: { ...fromGroup.layout, height: this.computeMinGroupHeight(fromItemIds.length) } };
        const updToGroup:   Group = { ...toGroup,   itemIds: toItemIds,   layout: { ...toGroup.layout,   height: this.computeMinGroupHeight(toItemIds.length)   } };

        const allTasks     = this.tasks$.getValue();
        const movedTask: Task = { ...task, groupId: toGroupId };

        const toTasks: Task[] = toItemIds.map(id =>
            id === taskId ? movedTask : (allTasks.find(t => (t._id as any) === id)!)
        ).filter(Boolean);

        const fromTasks = fromItemIds.map(id => allTasks.find(t => (t._id as any) === id)!).filter(Boolean);

        const toLayouts   = this.computeGroupItemLayouts(updToGroup,   toTasks);
        const fromLayouts = this.computeGroupItemLayouts(updFromGroup, fromTasks);

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

    relayoutGroup(groupId: string, currentTasks: Task[], resizeLayout?: Layout): Observable<Task[]> {
        const existing = this.groups$.getValue().find(g => (g._id as any) === groupId);
        if (!existing) { return of([]); }

        const groupTasks = existing.itemIds
            .map(id => currentTasks.find(t => (t._id as any) === id))
            .filter((t): t is Task => !!t);

        // Apply any new x/y/width from a resize event, then auto-compute height
        const baseLayout = resizeLayout
            ? { ...existing.layout, x: resizeLayout.x, y: resizeLayout.y, width: resizeLayout.width }
            : existing.layout;
        const finalLayout = { ...baseLayout, height: this.computeMinGroupHeight(groupTasks.length) };
        const group = { ...existing, layout: finalLayout };

        this.groups$.next(this.groups$.getValue().map(g => (g._id as any) === groupId ? group : g));

        if (groupTasks.length === 0) {
            return this.groupApi.update(groupId, { layout: finalLayout }).pipe(map(() => []));
        }

        const layouts      = this.computeGroupItemLayouts(group, groupTasks);
        const updatedTasks = groupTasks.map((t, i) => ({ ...t, layout: layouts[i] }));

        this.tasks$.next(this.tasks$.getValue().map(t => {
            const u = updatedTasks.find(ut => (ut._id as any) === (t._id as any));
            return u ?? t;
        }));

        return forkJoin([
            this.groupApi.update(groupId, { layout: finalLayout }),
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
