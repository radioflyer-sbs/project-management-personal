import { Component, Input, Output, EventEmitter, HostListener, inject, OnChanges, OnInit, SimpleChanges, NgZone, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { takeUntil } from 'rxjs/operators';
import { ComponentBase } from '../../component-base/component-base.component';
import { CanvasInteractionService, ResizeHandle } from '../../../services/canvas-interaction.service';
import { ClockService } from '../../../services/clock.service';
import { formatDueCountdown, DueCountdown } from '../../../services/due-date.util';
import { Task } from '../../../../model/shared-models/task.model';
import { Layout } from '../../../../model/shared-models/layout.model';
import { TaskCounts } from '../../../../model/shared-models/task-counts.model';
import { TaskUrgency } from '../../../../model/shared-models/task-urgency.enum';
import { TaskProjectedChildrenComponent } from './task-projected-children/task-projected-children.component';
import { MarkdownViewComponent } from '../../shared/markdown-view/markdown-view.component';
import { MarkdownEditorComponent } from '../../shared/markdown-editor/markdown-editor.component';

@Component({
    selector: 'app-task-card',
    standalone: true,
    imports: [CommonModule, FormsModule, DatePickerModule, TaskProjectedChildrenComponent, MarkdownViewComponent, MarkdownEditorComponent],
    templateUrl: './task-card.component.html',
    styleUrl: './task-card.component.scss',
})
export class TaskCardComponent extends ComponentBase implements OnInit, OnChanges {

    constructor() { super(); }

    @Input({ required: true }) task!: Task;
    @Input() selected = false;
    @Input() counts: TaskCounts | undefined;

    @Output() selected$               = new EventEmitter<Task>();
    @Output() drillIn$                = new EventEmitter<Task>();
    @Output() taskEdited$             = new EventEmitter<{ title: string; description: string }>();
    @Output() urgencyChanged$         = new EventEmitter<TaskUrgency>();
    @Output() projectToParentChanged$ = new EventEmitter<boolean>();
    @Output() completeChanged$        = new EventEmitter<boolean>();
    @Output() childCompletionChanged$ = new EventEmitter<{ childId: string; isComplete: boolean }>();
    @Output() layoutChanged$          = new EventEmitter<{ task: Task; layout: Layout }>();
    @Output() dragStarted$            = new EventEmitter<PointerEvent>();
    @Output() contextMenu$            = new EventEmitter<MouseEvent>();
    @Output() dueDateChanged$         = new EventEmitter<Date | undefined>();

    @ViewChild('titleInput')       private titleInputRef?: ElementRef<HTMLInputElement>;

    private readonly interaction = inject(CanvasInteractionService);
    private readonly clock       = inject(ClockService);
    private readonly zone        = inject(NgZone);
    private readonly el          = inject(ElementRef<HTMLElement>);

    /** Current time, refreshed by the shared clock; drives the live due-date countdown. */
    private now = new Date();

    // Due-date picker
    dueDatePickerOpen = false;
    dueDateModel: Date | undefined = undefined;

    localLayout!: Layout;
    private isDragging = false;

    /** True while this card is one of the items being dragged (drop zone hidden, pointer-events off). */
    amBeingDragged = false;
    /** True while another item is being dragged — reveals this card's "make child" drop zone. */
    showDropZone = false;
    /** True while the pointer is over this card's drop zone. */
    dropHovered = false;

    // Inline edit state
    editingTitle       = false;
    editingDescription = false;
    localTitle         = '';
    localDescription   = '';

    // Urgency picker
    dropdownOpen  = false;
    localUrgency  = TaskUrgency.Normal;

    readonly urgencyLevels = [
        { value: TaskUrgency.LongTermGoal, label: 'Long-term Goal', icon: 'pi-flag',                 color: '#5b8dd9' },
        { value: TaskUrgency.Low,          label: 'Low',             icon: 'pi-angle-double-down',    color: '#8e98a8' },
        { value: TaskUrgency.Normal,       label: 'Normal',          icon: 'pi-minus',                color: '#8e98a8' },
        { value: TaskUrgency.Important,    label: 'Important',       icon: 'pi-angle-double-up',      color: '#e0871a' },
        { value: TaskUrgency.Urgent,       label: 'Urgent',          icon: 'pi-exclamation-triangle', color: '#d95b5b' },
        { value: TaskUrgency.Immediate,    label: 'Immediate',       icon: 'pi-bolt',                 color: '#c0392b' },
    ] as const;

    ngOnInit(): void {
        this.zone.runOutsideAngular(() => {
            this.interaction.moveDragging$.pipe(takeUntil(this.ngDestroy$)).subscribe(e => {
                if (e.id !== this.task._id) { return; }
                if (!e.hasMoved) { return; }
                this.isDragging = true;
                this.localLayout = e.layout;
                this.applyLayoutDirect(e.layout);
            });
            this.interaction.resizeDragging$.pipe(takeUntil(this.ngDestroy$)).subscribe(e => {
                if (e.id !== this.task._id) { return; }
                this.isDragging = true;
                this.localLayout = e.layout;
                this.applyLayoutDirect(e.layout);
            });
        });

        this.interaction.moveEnded$.pipe(takeUntil(this.ngDestroy$)).subscribe(e => {
            if (e.id !== this.task._id) { return; }
            this.isDragging = false;
            if (!e.hasMoved) {
                this.localLayout = { ...this.task.layout };
                this.applyLayoutDirect(this.task.layout);
            } else {
                this.localLayout = e.layout;
                this.applyLayoutDirect(e.layout);
            }
        });
        this.interaction.resizeEnded$.pipe(takeUntil(this.ngDestroy$)).subscribe(e => {
            if (e.id !== this.task._id) { return; }
            this.isDragging = false;
            this.localLayout = e.layout;
            this.applyLayoutDirect(e.layout);
        });

        // Drop-zone visibility tracks the global drag state (emitted inside the Angular zone).
        this.interaction.dragState$.pipe(takeUntil(this.ngDestroy$)).subscribe(s => {
            this.amBeingDragged = s.active && s.draggedIds.includes(this.task._id as string);
            this.showDropZone   = s.active && !this.amBeingDragged;
            if (!s.active) { this.dropHovered = false; }
        });

        // Shared tick drives the live due-date countdown (runs in-zone → re-renders).
        this.clock.now$.pipe(takeUntil(this.ngDestroy$)).subscribe(d => this.now = d);
    }

    get dueCountdown(): DueCountdown | null {
        return this.task.dueDate ? formatDueCountdown(new Date(this.task.dueDate), this.now) : null;
    }

    private applyLayoutDirect(l: Layout): void {
        const div = this.el.nativeElement.firstElementChild as HTMLElement;
        div.style.left   = `${l.x}px`;
        div.style.top    = `${l.y}px`;
        div.style.width  = `${l.width}px`;
        div.style.height = `${l.height}px`;
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['task']) {
            if (!this.isDragging)          { this.localLayout      = { ...this.task.layout }; }
            if (!this.editingTitle)        { this.localTitle        = this.task.title; }
            if (!this.editingDescription)  { this.localDescription  = this.task.description; }
            if (!this.dropdownOpen)        { this.localUrgency      = this.task.urgency; }
        }
    }

    // --- Inline title editing ---

    startEditTitle(e: MouseEvent): void {
        e.stopPropagation();
        this.editingTitle = true;
        setTimeout(() => {
            this.titleInputRef?.nativeElement.focus();
            this.titleInputRef?.nativeElement.select();
        });
    }

    commitTitle(): void {
        this.editingTitle = false;
        this.taskEdited$.emit({ title: this.localTitle, description: this.localDescription });
    }

    cancelTitle(): void {
        this.editingTitle = false;
        this.localTitle = this.task.title;
    }

    // --- Inline description editing ---

    startEditDescription(e: MouseEvent): void {
        e.stopPropagation();
        this.editingDescription = true;
    }

    onDescriptionCommit(markdown: string): void {
        this.editingDescription = false;
        this.localDescription = markdown;
        this.taskEdited$.emit({ title: this.localTitle, description: markdown });
    }

    cancelDescription(): void {
        this.editingDescription = false;
        this.localDescription = this.task.description;
    }

    // --- Urgency picker ---

    get currentUrgencyOpt() {
        return this.urgencyLevels.find(o => o.value === this.localUrgency) ?? this.urgencyLevels[2];
    }

    toggleUrgencyDropdown(e: MouseEvent): void {
        e.stopPropagation();
        this.dropdownOpen = !this.dropdownOpen;
    }

    selectUrgency(urgency: TaskUrgency, e: MouseEvent): void {
        e.stopPropagation();
        this.localUrgency = urgency;
        this.dropdownOpen = false;
        this.urgencyChanged$.emit(urgency);
    }

    @HostListener('document:mousedown', ['$event'])
    onDocumentMousedown(e: MouseEvent): void {
        const outside = !this.el.nativeElement.contains(e.target as Node)
            // The datepicker overlay panel is appended to <body>, outside the card element.
            && !(e.target as HTMLElement)?.closest('.p-datepicker-panel, p-datepicker');
        if (this.dropdownOpen && outside) { this.dropdownOpen = false; }
        if (this.dueDatePickerOpen && outside) { this.dueDatePickerOpen = false; }
    }

    // --- Due date ---

    toggleDueDatePicker(e: MouseEvent): void {
        e.stopPropagation();
        this.dropdownOpen = false;
        this.dueDateModel = this.task.dueDate ? new Date(this.task.dueDate) : undefined;
        this.dueDatePickerOpen = !this.dueDatePickerOpen;
    }

    commitDueDate(): void {
        this.dueDatePickerOpen = false;
        this.dueDateChanged$.emit(this.dueDateModel ?? undefined);
    }

    clearDueDate(): void {
        this.dueDatePickerOpen = false;
        this.dueDateModel = undefined;
        this.dueDateChanged$.emit(undefined);
    }

    // --- Card interaction ---

    get cardStyle(): Record<string, string> {
        const l = this.localLayout;
        return {
            left:     `${l.x}px`,
            top:      `${l.y}px`,
            width:    `${l.width}px`,
            height:   `${l.height}px`,
            zIndex:   (this.dropdownOpen || this.dueDatePickerOpen) ? '99999' : `${l.zIndex}`,
            opacity:  this.task.isComplete ? '0.55' : '1',
        };
    }

    get urgencyClass(): string {
        return `urgency--${this.localUrgency}`;
    }

    onMousedown(e: MouseEvent): void {
        if (e.button !== 0) { return; }
        e.stopPropagation();
        this.dropdownOpen = false;
        this.selected$.emit(this.task);
        this.dragStarted$.emit(e as unknown as PointerEvent);
    }

    onResizeMousedown(e: MouseEvent, handle: ResizeHandle): void {
        e.stopPropagation();
        this.interaction.startResize(
            e as unknown as PointerEvent,
            this.task._id as string,
            true,
            handle,
            this.localLayout,
        );
    }

    onClick(e: MouseEvent): void {
        e.stopPropagation();
    }

    onContextMenu(e: MouseEvent): void {
        e.preventDefault();
        e.stopPropagation();
        this.contextMenu$.emit(e);
    }

    // --- Drop zone (drag another item onto this card to make it a child) ---

    onDropZoneEnter(): void {
        this.dropHovered = true;
        this.interaction.setDropTarget(this.task._id as string);
    }

    onDropZoneLeave(): void {
        this.dropHovered = false;
        this.interaction.clearDropTarget(this.task._id as string);
    }

    onDrillClick(e: MouseEvent): void {
        e.stopPropagation();
        this.drillIn$.emit(this.task);
    }

    toggleProjectToParent(e: MouseEvent): void {
        e.stopPropagation();
        this.projectToParentChanged$.emit(!(this.task.projectToParent ?? false));
    }

    toggleComplete(e: MouseEvent): void {
        e.stopPropagation();
        this.completeChanged$.emit(!(this.task.isComplete ?? false));
    }

    readonly resizeHandles: ResizeHandle[] = ['nw','n','ne','e','se','s','sw','w'];
}
