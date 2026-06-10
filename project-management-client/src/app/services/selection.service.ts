import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Task } from '../../model/shared-models/task.model';
import { Note } from '../../model/shared-models/note.model';
import { Project } from '../../model/shared-models/project.model';
import { Group } from '../../model/shared-models/group.model';

export type SelectedItem =
    | { type: 'project'; item: Project }
    | { type: 'task';    item: Task }
    | { type: 'note';    item: Note }
    | { type: 'group';   item: Group }
    | null;

@Injectable({ providedIn: 'root' })
export class SelectionService {

    constructor() { }

    private readonly selection$ = new BehaviorSubject<SelectedItem>(null);
    readonly currentSelection$: Observable<SelectedItem> = this.selection$.asObservable();

    select(item: SelectedItem): void {
        this.selection$.next(item);
    }

    clear(): void {
        this.selection$.next(null);
    }

    get current(): SelectedItem {
        return this.selection$.getValue();
    }
}
