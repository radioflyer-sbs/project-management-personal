import { Component, Input, Output, EventEmitter, inject, OnChanges, OnInit, SimpleChanges, NgZone, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntil } from 'rxjs/operators';
import { ComponentBase } from '../../component-base/component-base.component';
import { CanvasInteractionService, ResizeHandle } from '../../../services/canvas-interaction.service';
import { Task } from '../../../../model/shared-models/task.model';
import { Layout } from '../../../../model/shared-models/layout.model';
import { TaskUrgency } from '../../../../model/shared-models/task-urgency.enum';
import { TaskCounts } from '../../../../model/shared-models/task-counts.model';

@Component({
    selector: 'app-task-card',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './task-card.component.html',
    styleUrl: './task-card.component.scss',
})
export class TaskCardComponent extends ComponentBase implements OnInit, OnChanges {

    constructor() { super(); }

    @Input({ required: true }) task!: Task;
    @Input() selected = false;
    @Input() counts: TaskCounts | undefined;

    @Output() selected$ = new EventEmitter<Task>();
    @Output() drillIn$  = new EventEmitter<Task>();
    @Output() layoutChanged$ = new EventEmitter<{ task: Task; layout: Layout }>();

    private readonly interaction = inject(CanvasInteractionService);
    private readonly zone        = inject(NgZone);
    private readonly el          = inject(ElementRef<HTMLElement>);

    localLayout!: Layout;
    private isDragging = false;

    ngOnInit(): void {
        this.zone.runOutsideAngular(() => {
            this.interaction.moveDragging$.pipe(takeUntil(this.ngDestroy$)).subscribe(e => {
                if (e.id !== this.task._id) { return; }
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

        // Inside zone: finalize localLayout on drop so [ngStyle] re-syncs to the
        // correct final position (not the stale bringToFront layout from tasks$).
        this.interaction.moveEnded$.pipe(takeUntil(this.ngDestroy$)).subscribe(e => {
            if (e.id !== this.task._id) { return; }
            this.isDragging = false;
            this.localLayout = e.layout;
            this.applyLayoutDirect(e.layout);
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
        if (changes['task'] && !this.isDragging) {
            this.localLayout = { ...this.task.layout };
        }
    }

    get cardStyle(): Record<string, string> {
        const l = this.localLayout;
        return {
            left:     `${l.x}px`,
            top:      `${l.y}px`,
            width:    `${l.width}px`,
            height:   `${l.height}px`,
            zIndex:   `${l.zIndex}`,
            opacity:  this.task.isComplete ? '0.55' : '1',
        };
    }

    get urgencyClass(): string {
        return `urgency--${this.task.urgency}`;
    }

    onMousedown(e: MouseEvent): void {
        if (e.button !== 0) { return; }
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

    onDblClick(e: MouseEvent): void {
        e.stopPropagation();
        this.drillIn$.emit(this.task);
    }

    readonly resizeHandles: ResizeHandle[] = ['nw','n','ne','e','se','s','sw','w'];
}
