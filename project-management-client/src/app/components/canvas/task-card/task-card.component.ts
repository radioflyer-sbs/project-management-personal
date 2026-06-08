import { Component, Input, Output, EventEmitter, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ComponentBase } from '../../component-base/component-base.component';
import { CanvasInteractionService, ResizeHandle } from '../../../services/canvas-interaction.service';
import { Task } from '../../../../model/shared-models/task.model';
import { Layout } from '../../../../model/shared-models/layout.model';
import { TaskUrgency } from '../../../../model/shared-models/task-urgency.enum';

@Component({
    selector: 'app-task-card',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './task-card.component.html',
    styleUrl: './task-card.component.scss',
})
export class TaskCardComponent extends ComponentBase implements OnChanges {

    constructor() { super(); }

    @Input({ required: true }) task!: Task;
    @Input() selected = false;

    @Output() selected$ = new EventEmitter<Task>();
    @Output() drillIn$  = new EventEmitter<Task>();
    @Output() layoutChanged$ = new EventEmitter<{ task: Task; layout: Layout }>();

    private readonly interaction = inject(CanvasInteractionService);

    localLayout!: Layout;

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['task']) {
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
        this.selected$.emit(this.task);
    }

    onDblClick(e: MouseEvent): void {
        e.stopPropagation();
        this.drillIn$.emit(this.task);
    }

    readonly resizeHandles: ResizeHandle[] = ['nw','n','ne','e','se','s','sw','w'];
}
