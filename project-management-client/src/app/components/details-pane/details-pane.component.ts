import { Component, inject, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { ColorPickerModule } from 'primeng/colorpicker';
import { DividerModule } from 'primeng/divider';
import { ComponentBase } from '../component-base/component-base.component';
import { SelectionService, SelectedItem } from '../../services/selection.service';
import { DetailsPaneService } from '../../services/details-pane.service';
import { DeletionService } from '../../services/deletion.service';
import { CanvasDataService } from '../../services/canvas-data.service';
import { ProjectsService } from '../../services/projects.service';
import { NavigationService } from '../../services/navigation.service';
import { Task } from '../../../model/shared-models/task.model';
import { Note } from '../../../model/shared-models/note.model';
import { Project } from '../../../model/shared-models/project.model';
import { TaskUrgency } from '../../../model/shared-models/task-urgency.enum';

@Component({
    selector: 'app-details-pane',
    standalone: true,
    imports: [
        CommonModule, FormsModule,
        ButtonModule, InputTextModule, TextareaModule,
        SelectModule, CheckboxModule, ColorPickerModule, DividerModule,
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
    private readonly navigation       = inject(NavigationService);

    selection: SelectedItem = null;

    // Edit buffers
    editTitle       = '';
    editDescription = '';
    editDetails     = '';
    editUrgency: TaskUrgency = TaskUrgency.Normal;
    editIsComplete  = false;
    editBgColor     = '#ffffff';

    // Host edit buffers
    hostName        = '';
    hostDescription = '';

    readonly urgencyOptions = [
        { label: 'Long Term Goal', value: TaskUrgency.LongTermGoal },
        { label: 'Low',            value: TaskUrgency.Low },
        { label: 'Normal',         value: TaskUrgency.Normal },
        { label: 'Important',      value: TaskUrgency.Important },
        { label: 'Urgent',         value: TaskUrgency.Urgent },
        { label: 'Immediate',      value: TaskUrgency.Immediate },
    ];

    ngOnInit(): void {
        this.selectionService.currentSelection$.pipe(takeUntil(this.ngDestroy$)).subscribe(sel => {
            this.selection = sel;
            this.populateBuffers(sel);
        });
    }

    private populateBuffers(sel: SelectedItem): void {
        if (!sel) {
            // Show host
            if (this.hostTask) {
                this.editTitle       = this.hostTask.title;
                this.editDescription = this.hostTask.description;
                this.editUrgency     = this.hostTask.urgency;
                this.editIsComplete  = this.hostTask.isComplete;
            } else if (this.hostProject) {
                this.hostName        = this.hostProject.name;
                this.hostDescription = this.hostProject.description;
            }
        } else if (sel.type === 'task') {
            this.editTitle       = sel.item.title;
            this.editDescription = sel.item.description;
            this.editUrgency     = sel.item.urgency;
            this.editIsComplete  = sel.item.isComplete;
        } else if (sel.type === 'note') {
            this.editTitle   = sel.item.title;
            this.editDetails = sel.item.details;
            this.editBgColor = sel.item.backgroundColor;
        } else if (sel.type === 'project') {
            this.hostName        = sel.item.name;
            this.hostDescription = sel.item.description;
        }
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

    saveTask(): void {
        const task = this.effectiveTask;
        if (!task) { return; }
        const updated: Task = {
            ...task,
            title:       this.editTitle,
            description: this.editDescription,
            urgency:     this.editUrgency,
            isComplete:  this.editIsComplete,
        };
        this.canvasData.updateTask(updated).subscribe(result => {
            if (this.selection?.type === 'task') {
                this.selectionService.select({ type: 'task', item: result });
            }
            this.detailsService.markClean();
        });
    }

    saveNote(): void {
        const note = this.effectiveNote;
        if (!note) { return; }
        const updated: Note = {
            ...note,
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
        }).subscribe(updated => {
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

    onMarkDirty(): void {
        this.detailsService.markDirty();
    }
}
