import { Component, inject, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { DropdownModule } from 'primeng/dropdown';
import { CheckboxModule } from 'primeng/checkbox';
import { ColorPickerModule } from 'primeng/colorpicker';
import { InputNumberModule } from 'primeng/inputnumber';
import { ComponentBase } from '../component-base/component-base.component';
import { SelectionService, SelectedItem } from '../../services/selection.service';
import { DetailsPaneService } from '../../services/details-pane.service';
import { DeletionService } from '../../services/deletion.service';
import { CanvasDataService } from '../../services/canvas-data.service';
import { ProjectsService } from '../../services/projects.service';
import { DataDefinitionApiClient } from '../../services/api-clients/data-definition-api.client';
import { Task } from '../../../model/shared-models/task.model';
import { Note } from '../../../model/shared-models/note.model';
import { Project } from '../../../model/shared-models/project.model';
import { Dashboard, DashboardWidget } from '../../../model/shared-models/dashboard.model';
import { DataDefinition, DataValue } from '../../../model/shared-models/data-definition.model';
import { TaskUrgency } from '../../../model/shared-models/task-urgency.enum';

@Component({
    selector: 'app-details-pane',
    standalone: true,
    imports: [
        CommonModule, FormsModule,
        ButtonModule, InputTextModule, TextareaModule,
        SelectModule, DropdownModule, CheckboxModule, ColorPickerModule,
        InputNumberModule,
    ],
    templateUrl: './details-pane.component.html',
    styleUrl: './details-pane.component.scss',
})
export class DetailsPaneComponent extends ComponentBase implements OnInit {

    constructor() { super(); }

    @Input() hostProject: Project | null = null;
    @Input() hostTask: Task | null = null;

    private readonly selectionService = inject(SelectionService);
    private readonly detailsService   = inject(DetailsPaneService);
    private readonly deletionService  = inject(DeletionService);
    private readonly canvasData       = inject(CanvasDataService);
    private readonly projectsService  = inject(ProjectsService);
    private readonly dataDefApi       = inject(DataDefinitionApiClient);

    selection: SelectedItem = null;

    // Edit buffers — task/note/project
    editTitle            = '';
    editDescription      = '';
    editDetails          = '';
    editUrgency: TaskUrgency = TaskUrgency.Normal;
    editIsComplete       = false;
    editProjectToParent  = false;
    editBgColor          = '#ffffff';

    // Host edit buffers
    hostName        = '';
    hostDescription = '';

    // Dashboard widget value buffers
    defValueMap:    Record<string, DataValue>  = {};
    listValueMap:   Record<string, string[]>   = {};
    newListItemMap: Record<string, string>     = {};

    private currentDashboardId: string | null = null;

    readonly urgencyOptions = [
        { label: 'Long Term Goal', value: TaskUrgency.LongTermGoal },
        { label: 'Low',            value: TaskUrgency.Low },
        { label: 'Normal',         value: TaskUrgency.Normal },
        { label: 'Important',      value: TaskUrgency.Important },
        { label: 'Urgent',         value: TaskUrgency.Urgent },
        { label: 'Immediate',      value: TaskUrgency.Immediate },
    ];

    private readonly change$ = new Subject<void>();
    private pendingSave = false;

    ngOnInit(): void {
        this.selectionService.currentSelection$.pipe(takeUntil(this.ngDestroy$)).subscribe(sel => {
            if (this.pendingSave && sel?.type !== 'dashboard') { this.flushSave(); }
            this.selection = sel;
            this.populateBuffers(sel);
        });

        this.change$.pipe(
            debounceTime(1000),
            takeUntil(this.ngDestroy$),
        ).subscribe(() => {
            if (this.pendingSave) { this.flushSave(); }
        });
    }

    override ngOnDestroy(): void {
        if (this.pendingSave) { this.flushSave(); }
        super.ngOnDestroy();
    }

    public onChange(): void {
        this.pendingSave = true;
        this.detailsService.markDirty();
        this.change$.next();
    }

    private flushSave(): void {
        this.pendingSave = false;
        if (this.showingTask) { this.saveTask(); }
        else if (this.showingNote) { this.saveNote(); }
        else if (this.showingProject) { this.saveProject(); }
    }

    private populateBuffers(sel: SelectedItem): void {
        if (sel?.type === 'dashboard') {
            const id = sel.item._id as string;
            if (id !== this.currentDashboardId) {
                this.currentDashboardId = id;
                this.populateDashboardValues(sel.defs);
            }
            return;
        }

        this.currentDashboardId = null;

        if (!sel) {
            if (this.hostTask) {
                this.editTitle           = this.hostTask.title;
                this.editDescription     = this.hostTask.description;
                this.editUrgency         = this.hostTask.urgency;
                this.editIsComplete      = this.hostTask.isComplete;
                this.editProjectToParent = this.hostTask.projectToParent ?? false;
            } else if (this.hostProject) {
                this.hostName        = this.hostProject.name;
                this.hostDescription = this.hostProject.description;
            }
        } else if (sel.type === 'task') {
            this.editTitle           = sel.item.title;
            this.editDescription     = sel.item.description;
            this.editUrgency         = sel.item.urgency;
            this.editIsComplete      = sel.item.isComplete;
            this.editProjectToParent = sel.item.projectToParent ?? false;
        } else if (sel.type === 'note') {
            this.editTitle   = sel.item.title;
            this.editDetails = sel.item.details;
            this.editBgColor = sel.item.backgroundColor;
        } else if (sel.type === 'project') {
            this.hostName        = sel.item.name;
            this.hostDescription = sel.item.description;
        }
    }

    private populateDashboardValues(defs: DataDefinition[]): void {
        this.defValueMap    = {};
        this.listValueMap   = {};
        this.newListItemMap = {};
        defs.forEach(def => {
            if (def.valueType === 'list') {
                this.listValueMap[def.id]   = Array.isArray(def.value) ? [...def.value as string[]] : [];
                this.newListItemMap[def.id] = '';
            } else if (def.valueType === 'boolean') {
                this.defValueMap[def.id] = !!def.value;
            } else if (def.valueType === 'number') {
                this.defValueMap[def.id] = typeof def.value === 'number' ? def.value : 0;
            } else {
                this.defValueMap[def.id] = def.value != null ? String(def.value) : '';
            }
        });
    }

    getDefForWidget(dataId: string): DataDefinition | undefined {
        const sel = this.selection;
        if (sel?.type !== 'dashboard') { return undefined; }
        return sel.defs.find(d => d.id === dataId);
    }

    saveDefValue(def: DataDefinition, value: DataValue): void {
        const sel = this.selection;
        if (sel?.type !== 'dashboard') { return; }
        const projectId = sel.item.projectId as string;
        this.dataDefApi.setValue(projectId, def.id, value)
            .pipe(takeUntil(this.ngDestroy$))
            .subscribe(updated => {
                const updatedDefs = sel.defs.map(d => d.id === updated.id ? updated : d);
                this.selectionService.updateDashboardDefs(updatedDefs);
            });
    }

    addListItem(def: DataDefinition): void {
        const newItem = (this.newListItemMap[def.id] ?? '').trim();
        if (!newItem) { return; }
        this.newListItemMap[def.id] = '';
        const updated = [...(this.listValueMap[def.id] ?? []), newItem];
        this.listValueMap[def.id] = updated;
        this.saveDefValue(def, updated);
    }

    removeListItem(def: DataDefinition, index: number): void {
        const updated = (this.listValueMap[def.id] ?? []).filter((_, i) => i !== index);
        this.listValueMap[def.id] = updated;
        this.saveDefValue(def, updated);
    }

    get showingTask(): boolean {
        return this.selection?.type === 'task' || (!this.selection && !!this.hostTask);
    }

    get showingNote(): boolean {
        return this.selection?.type === 'note';
    }

    get showingProject(): boolean {
        return this.selection?.type === 'project' || (!this.selection && !!this.hostProject && !this.hostTask);
    }

    get showingDashboard(): boolean {
        return this.selection?.type === 'dashboard';
    }

    get showProjectToParent(): boolean {
        return !!this.effectiveTask?.parentTaskId;
    }

    get effectiveTask(): Task | null {
        if (this.selection?.type === 'task') { return this.selection.item; }
        return this.hostTask;
    }

    get effectiveNote(): Note | null {
        if (this.selection?.type === 'note') { return this.selection.item; }
        return null;
    }

    get effectiveProject(): Project | null {
        if (this.selection?.type === 'project') { return this.selection.item; }
        return this.hostProject;
    }

    get effectiveDashboard(): { item: Dashboard; defs: DataDefinition[] } | null {
        if (this.selection?.type === 'dashboard') {
            return { item: this.selection.item, defs: this.selection.defs };
        }
        return null;
    }

    saveTask(): void {
        const selTask = this.effectiveTask;
        if (!selTask) { return; }
        const current = this.canvasData.getTaskById(selTask._id as string) ?? selTask;
        const updated: Task = {
            ...current,
            title:           this.editTitle,
            description:     this.editDescription,
            urgency:         this.editUrgency,
            isComplete:      this.editIsComplete,
            projectToParent: this.editProjectToParent,
        };
        this.canvasData.updateTask(updated).subscribe(result => {
            if (this.selection?.type === 'task') {
                this.selectionService.select({ type: 'task', item: result });
            }
            this.detailsService.markClean();
        });
    }

    saveNote(): void {
        const selNote = this.effectiveNote;
        if (!selNote) { return; }
        const current = this.canvasData.getNoteById(selNote._id as string) ?? selNote;
        const updated: Note = {
            ...current,
            title:           this.editTitle,
            details:         this.editDetails,
            backgroundColor: this.editBgColor,
        };
        this.canvasData.updateNote(updated).subscribe(result => {
            if (this.selection?.type === 'note') {
                this.selectionService.select({ type: 'note', item: result });
            }
            this.detailsService.markClean();
        });
    }

    saveProject(): void {
        const project = this.effectiveProject;
        if (!project) { return; }
        this.projectsService.update(project._id as string, {
            name:        this.hostName,
            description: this.hostDescription,
        }).subscribe(() => {
            this.detailsService.markClean();
        });
    }

    deleteTask(): void {
        const task = this.effectiveTask;
        if (!task) { return; }
        this.deletionService.deleteTask(task._id as string, task.title, () => {
            this.canvasData.removeTask(task._id as string);
        });
    }

    deleteNote(): void {
        const note = this.effectiveNote;
        if (!note) { return; }
        this.deletionService.deleteNote(note._id as string, note.title, () => {
            this.canvasData.removeNote(note._id as string);
        });
    }
}
