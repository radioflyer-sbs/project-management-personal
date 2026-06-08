import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SelectionService, SelectedItem } from './selection.service';
import { Task } from '../../model/shared-models/task.model';
import { Note } from '../../model/shared-models/note.model';
import { Project } from '../../model/shared-models/project.model';

/** Tracks the edit buffer for the currently selected item in the Details Pane. */
@Injectable({ providedIn: 'root' })
export class DetailsPaneService {

    constructor() { }

    private readonly selection = inject(SelectionService);

    private readonly dirty$ = new BehaviorSubject<boolean>(false);
    readonly isDirty$: Observable<boolean> = this.dirty$.asObservable();

    markDirty(): void { this.dirty$.next(true); }
    markClean(): void { this.dirty$.next(false); }
    get isDirty(): boolean { return this.dirty$.getValue(); }
}
