import { Component, Input, Output, EventEmitter, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ComponentBase } from '../../component-base/component-base.component';
import { CanvasInteractionService, ResizeHandle } from '../../../services/canvas-interaction.service';
import { Note } from '../../../../model/shared-models/note.model';
import { Layout } from '../../../../model/shared-models/layout.model';

@Component({
    selector: 'app-note-card',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './note-card.component.html',
    styleUrl: './note-card.component.scss',
})
export class NoteCardComponent extends ComponentBase implements OnChanges {

    constructor() { super(); }

    @Input({ required: true }) note!: Note;
    @Input() selected = false;

    @Output() selected$ = new EventEmitter<Note>();
    @Output() layoutChanged$ = new EventEmitter<{ note: Note; layout: Layout }>();

    private readonly interaction = inject(CanvasInteractionService);

    localLayout!: Layout;

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['note']) {
            this.localLayout = { ...this.note.layout };
        }
    }

    get cardStyle(): Record<string, string> {
        const l = this.localLayout;
        return {
            left:   `${l.x}px`,
            top:    `${l.y}px`,
            width:  `${l.width}px`,
            height: `${l.height}px`,
            zIndex: `${l.zIndex}`,
        };
    }

    get bodyStyle(): Record<string, string> {
        return { background: this.note.backgroundColor || '#ffffff' };
    }

    onMousedown(e: MouseEvent): void {
        if (e.button !== 0) { return; }
        this.selected$.emit(this.note);
        this.interaction.startMove(
            e as unknown as PointerEvent,
            this.note._id as string,
            false,
            this.localLayout,
            (e.currentTarget as HTMLElement),
        );
    }

    onResizeMousedown(e: MouseEvent, handle: ResizeHandle): void {
        e.stopPropagation();
        this.interaction.startResize(
            e as unknown as PointerEvent,
            this.note._id as string,
            false,
            handle,
            this.localLayout,
        );
    }

    onClick(e: MouseEvent): void {
        e.stopPropagation();
        this.selected$.emit(this.note);
    }

    readonly resizeHandles: ResizeHandle[] = ['nw','n','ne','e','se','s','sw','w'];
}
