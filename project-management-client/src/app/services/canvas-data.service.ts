import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subject, forkJoin } from 'rxjs';
import { switchMap, debounceTime, tap } from 'rxjs/operators';
import { TaskApiClient, CreateTaskDto } from './api-clients/task-api.client';
import { NoteApiClient, CreateNoteDto } from './api-clients/note-api.client';
import { ProjectApiClient } from './api-clients/project-api.client';
import { Task } from '../../model/shared-models/task.model';
import { Note } from '../../model/shared-models/note.model';
import { Layout } from '../../model/shared-models/layout.model';
import { TaskUrgency } from '../../model/shared-models/task-urgency.enum';
import { CanvasViewState } from '../../model/shared-models/canvas-view-state.model';
import { DEFAULT_ITEM_WIDTH, DEFAULT_ITEM_HEIGHT } from '../../model/shared-models/canvas-constants';

/** Manages the data (tasks + notes) for one active canvas. Provided per CanvasHostComponent. */
@Injectable()
export class CanvasDataService {

    constructor() { }

    private readonly taskApi    = inject(TaskApiClient);
    private readonly noteApi    = inject(NoteApiClient);
    private readonly projectApi = inject(ProjectApiClient);

    private projectId = '';
    private parentTaskId: string | undefined;
    private ancestorTaskIds: string[] = [];

    private readonly tasks$  = new BehaviorSubject<Task[]>([]);
    private readonly notes$  = new BehaviorSubject<Note[]>([]);
    private readonly reload$ = new Subject<void>();

    readonly tasks: Observable<Task[]>  = this.tasks$.asObservable();
    readonly notes: Observable<Note[]>  = this.notes$.asObservable();

    initialize(projectId: string, parentTaskId: string | undefined, ancestorTaskIds: string[]): void {
        this.projectId      = projectId;
        this.parentTaskId   = parentTaskId;
        this.ancestorTaskIds = ancestorTaskIds;
        this.load();
    }

    load(): void {
        const tasks$ = this.parentTaskId
            ? this.taskApi.getByParentTask(this.parentTaskId)
            : this.taskApi.getByProject(this.projectId);

        const notes$ = this.parentTaskId
            ? this.noteApi.getByParentTask(this.parentTaskId)
            : this.noteApi.getByProject(this.projectId);

        forkJoin([tasks$, notes$]).subscribe(([tasks, notes]) => {
            this.tasks$.next(tasks);
            this.notes$.next(notes);
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

    updateTaskLayout(taskId: string, layout: Layout): void {
        // Preserve the zIndex set by bringToFront; apply the new position immediately.
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
            if (task) {
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
}
