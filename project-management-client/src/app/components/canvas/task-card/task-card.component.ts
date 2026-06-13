import { Component, Input, Output, EventEmitter, HostListener, inject, OnChanges, OnInit, SimpleChanges, NgZone, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { ComponentBase } from '../../component-base/component-base.component';
import { CanvasInteractionService, ResizeHandle } from '../../../services/canvas-interaction.service';
import { Task } from '../../../../model/shared-models/task.model';
import { Layout } from '../../../../model/shared-models/layout.model';
import { TaskCounts } from '../../../../model/shared-models/task-counts.model';
import { TaskUrgency } from '../../../../model/shared-models/task-urgency.enum';

@Component({
    selector: 'app-task-card',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './task-card.component.html',
    styleUrl: './task-card.component.scss',
})
export class TaskCardComponent extends ComponentBase implements OnInit, OnChanges {

    constructor() { super(); }

    @Input({ required: true }) task!: Task;
    @Input() selected = false;
    @Input() counts: TaskCounts | undefined;

    @Output() selected$        = new EventEmitter<Task>();
    @Output() drillIn$         = new EventEmitter<Task>();
    @Output() taskEdited$      = new EventEmitter<{ title: string; description: string }>();
    @Output() urgencyChanged$  = new EventEmitter<TaskUrgency>();
    @Output() layoutChanged$   = new EventEmitter<{ task: Task; layout: Layout }>();

    @ViewChild('titleInput')       private titleInputRef?: ElementRef<HTMLInputElement>;
    @ViewChild('descriptionInput') private descriptionInputRef?: ElementRef<HTMLTextAreaElement>;

    private readonly interaction = inject(CanvasInteractionService);
    private readonly zone        = inject(NgZone);
    private readonly el          = inject(ElementRef<HTMLElement>);

    localLayout!: Layout;
    private isDragging = false;

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
        setTimeout(() => this.descriptionInputRef?.nativeElement.focus());
    }

    commitDescription(): void {
        this.editingDescription = false;
        this.taskEdited$.emit({ title: this.localTitle, description: this.localDescription });
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
        if (this.dropdownOpen && !this.el.nativeElement.contains(e.target as Node)) {
            this.dropdownOpen = false;
        }
    }

    // --- Card interaction ---

    get cardStyle(): Record<string, string> {
        const l = this.localLayout;
        return {
            left:     `${l.x}px`,
            top:      `${l.y}px`,
            width:    `${l.width}px`,
            height:   `${l.height}px`,
            zIndex:   this.dropdownOpen ? '99999' : `${l.zIndex}`,
            opacity:  this.task.isComplete ? '0.55' : '1',
        };
    }

    get urgencyClass(): string {
        return `urgency--${this.localUrgency}`;
    }

    onMousedown(e: MouseEvent): void {
        if (e.button !== 0) { return; }
        this.dropdownOpen = false;
        this.selected$.emit(this.task);
        this.interaction.startMove(
            e as unknown as PointerEvent,
            this.task._id as string,
            true,
            this.localLayout,
            (e.currentTarget as HTMLElement),
        );
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

    onDrillClick(e: MouseEvent): void {
        e.stopPropagation();
        this.drillIn$.emit(this.task);
    }

    readonly resizeHandles: ResizeHandle[] = ['nw','n','ne','e','se','s','sw','w'];
}
