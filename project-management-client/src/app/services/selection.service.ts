import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Task } from '../../model/shared-models/task.model';
import { Note } from '../../model/shared-models/note.model';
import { Project } from '../../model/shared-models/project.model';
import { Group } from '../../model/shared-models/group.model';

/** Legacy single-item type kept for details-pane compatibility. */
export type SelectedItem =
    | { type: 'project'; item: Project }
    | { type: 'task';    item: Task }
    | { type: 'note';    item: Note }
    | { type: 'group';   item: Group }
    | null;

/** Canvas items that can be multi-selected. */
export type SelectableItem =
    | { type: 'task';  item: Task }
    | { type: 'note';  item: Note }
    | { type: 'group'; item: Group }

@Injectable({ providedIn: 'root' })
export class SelectionService {

    constructor() { }

    private readonly items$ = new BehaviorSubject<SelectableItem[]>([]);

    /** Full multi-selection stream. */
    readonly selection$: Observable<SelectableItem[]> = this.items$.asObservable();

    /**
     * Legacy single-item stream for the details pane.
     * Emits the sole selected item when exactly one is selected, null otherwise.
     */
    readonly currentSelection$: Observable<SelectedItem> = this.items$.pipe(
        map(items => items.length === 1 ? items[0] : null)
    );

    /** Replace entire selection with one item, or toggle it in/out when extend = true. */
    select(item: SelectableItem, extend = false): void {
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
        this.items$.next([...items]);
    }

    /** Add items to the existing selection without duplicates (shift + rubber-band). */
    addMany(items: SelectableItem[]): void {
        const current = this.items$.getValue();
        const toAdd = items.filter(s =>
            !current.some(c => (c.item._id as any) === (s.item._id as any))
        );
        this.items$.next([...current, ...toAdd]);
    }

    /** Remove items by id from the selection (ctrl + rubber-band). */
    removeIds(ids: string[]): void {
        this.items$.next(this.items$.getValue().filter(
            s => !ids.includes((s.item._id as any))
        ));
    }

    /**
     * Update an already-selected item in place (used after a save returns fresh data
     * so the details pane gets the updated item without losing the rest of the selection).
     */
    updateItem(item: SelectableItem): void {
        const current = this.items$.getValue();
        const id = (item.item._id as any);
        if (current.some(s => (s.item._id as any) === id)) {
            this.items$.next(current.map(s => (s.item._id as any) === id ? item : s));
        }
    }

    clear(): void {
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
        const items = this.items$.getValue();
        return items.length === 1 ? items[0] : null;
    }
}
