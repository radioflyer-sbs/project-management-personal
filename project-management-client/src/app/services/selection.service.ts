import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { Task } from '../../model/shared-models/task.model';
import { Note } from '../../model/shared-models/note.model';
import { Project } from '../../model/shared-models/project.model';
import { Group } from '../../model/shared-models/group.model';
import { Dashboard } from '../../model/shared-models/dashboard.model';
import { DataDefinition } from '../../model/shared-models/data-definition.model';

export type SelectedItem =
    | { type: 'project';   item: Project }
    | { type: 'task';      item: Task }
    | { type: 'note';      item: Note }
    | { type: 'group';     item: Group }
    | { type: 'dashboard'; item: Dashboard; defs: DataDefinition[] }
    | null;

/** Canvas items that can be multi-selected. */
export type SelectableItem =
    | { type: 'task';  item: Task }
    | { type: 'note';  item: Note }
    | { type: 'group'; item: Group }

@Injectable({ providedIn: 'root' })
export class SelectionService {

    constructor() { }

    private readonly items$    = new BehaviorSubject<SelectableItem[]>([]);
    private readonly override$ = new BehaviorSubject<SelectedItem>(null);

    /** Full multi-selection stream. */
    readonly selection$: Observable<SelectableItem[]> = this.items$.asObservable();

    /**
     * Single-item stream for the details pane.
     * Dashboard selections (override$) take priority over canvas multi-select.
     */
    readonly currentSelection$: Observable<SelectedItem> = combineLatest([
        this.items$,
        this.override$,
    ]).pipe(
        map(([items, override]) => override ?? (items.length === 1 ? items[0] : null))
    );

    /** Replace entire selection with one item, or toggle it in/out when extend = true. */
    select(item: SelectableItem, extend = false): void {
        this.override$.next(null);
        if (!extend) {
            this.items$.next([item]);
        } else {
            const current = this.items$.getValue();
            const id = (item.item._id as any);
            const exists = current.some(s => (s.item._id as any) === id);
            if (exists) {
                this.items$.next(current.filter(s => (s.item._id as any) !== id));
            } else {
                this.items$.next([...current, item]);
            }
        }
    }

    /** Replace entire selection with the given set (rubber-band result). */
    selectMany(items: SelectableItem[]): void {
        this.override$.next(null);
        this.items$.next([...items]);
    }

    /** Add items to the existing selection without duplicates (shift + rubber-band). */
    addMany(items: SelectableItem[]): void {
        this.override$.next(null);
        const current = this.items$.getValue();
        const toAdd = items.filter(s =>
            !current.some(c => (c.item._id as any) === (s.item._id as any))
        );
        this.items$.next([...current, ...toAdd]);
    }

    /** Remove items by id from the selection (ctrl + rubber-band). */
    removeIds(ids: string[]): void {
        this.override$.next(null);
        this.items$.next(this.items$.getValue().filter(
            s => !ids.includes((s.item._id as any))
        ));
    }

    /**
     * Update an already-selected item in place (used after a save returns fresh data).
     */
    updateItem(item: SelectableItem): void {
        const current = this.items$.getValue();
        const id = (item.item._id as any);
        if (current.some(s => (s.item._id as any) === id)) {
            this.items$.next(current.map(s => (s.item._id as any) === id ? item : s));
        }
    }

    /** Select a dashboard, clearing any canvas item selection. */
    selectDashboard(dashboard: Dashboard, defs: DataDefinition[]): void {
        this.items$.next([]);
        this.override$.next({ type: 'dashboard', item: dashboard, defs });
    }

    /** Update the defs on the current dashboard selection without re-populating the details pane buffers. */
    updateDashboardDefs(defs: DataDefinition[]): void {
        const current = this.override$.getValue();
        if (current?.type === 'dashboard') {
            this.override$.next({ ...current, defs });
        }
    }

    clear(): void {
        this.override$.next(null);
        this.items$.next([]);
    }

    isSelected(id: string): boolean {
        return this.items$.getValue().some(s => (s.item._id as any) === id);
    }

    get selectedItems(): SelectableItem[] {
        return this.items$.getValue();
    }

    /** Returns the sole selected item when exactly one is selected, otherwise null. */
    get current(): SelectedItem {
        return this.override$.getValue() ?? (
            this.items$.getValue().length === 1 ? this.items$.getValue()[0] : null
        );
    }
}
