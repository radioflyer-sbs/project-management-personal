import { Component, Input, Output, EventEmitter, inject, OnChanges, OnInit, SimpleChanges, NgZone, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { ComponentBase } from '../../component-base/component-base.component';
import { CanvasInteractionService, ResizeHandle } from '../../../services/canvas-interaction.service';
import { Note } from '../../../../model/shared-models/note.model';
import { Layout } from '../../../../model/shared-models/layout.model';
import { MarkdownViewComponent } from '../../shared/markdown-view/markdown-view.component';
import { MarkdownEditorComponent } from '../../shared/markdown-editor/markdown-editor.component';

@Component({
    selector: 'app-note-card',
    standalone: true,
    imports: [CommonModule, FormsModule, MarkdownViewComponent, MarkdownEditorComponent],
    templateUrl: './note-card.component.html',
    styleUrl: './note-card.component.scss',
})
export class NoteCardComponent extends ComponentBase implements OnInit, OnChanges {

    constructor() { super(); }

    @Input({ required: true }) note!: Note;
    @Input() selected = false;

    @Output() selected$    = new EventEmitter<Note>();
    @Output() noteEdited$  = new EventEmitter<{ title: string; details: string }>();
    @Output() dragStarted$ = new EventEmitter<PointerEvent>();
    @Output() contextMenu$ = new EventEmitter<MouseEvent>();

    @ViewChild('titleInput')   private titleInputRef?: ElementRef<HTMLInputElement>;

    private readonly interaction = inject(CanvasInteractionService);
    private readonly zone        = inject(NgZone);
    private readonly el          = inject(ElementRef<HTMLElement>);

    localLayout!: Layout;
    private isDragging = false;

    /** True while this note is being dragged — lets pointer events fall through to drop zones beneath. */
    amBeingDragged = false;

    editingTitle   = false;
    editingDetails = false;
    localTitle     = '';
    localDetails   = '';

    ngOnInit(): void {
        this.zone.runOutsideAngular(() => {
            this.interaction.moveDragging$.pipe(takeUntil(this.ngDestroy$)).subscribe(e => {
                if (e.id !== this.note._id) { return; }
                if (!e.hasMoved) { return; }
                this.isDragging = true;
                this.localLayout = e.layout;
                this.applyLayoutDirect(e.layout);
            });
            this.interaction.resizeDragging$.pipe(takeUntil(this.ngDestroy$)).subscribe(e => {
                if (e.id !== this.note._id) { return; }
                this.isDragging = true;
                this.localLayout = e.layout;
                this.applyLayoutDirect(e.layout);
            });
        });

        this.interaction.moveEnded$.pipe(takeUntil(this.ngDestroy$)).subscribe(e => {
            if (e.id !== this.note._id) { return; }
            this.isDragging = false;
            if (!e.hasMoved) {
                this.localLayout = { ...this.note.layout };
                this.applyLayoutDirect(this.note.layout);
            } else {
                this.localLayout = e.layout;
                this.applyLayoutDirect(e.layout);
            }
        });
        this.interaction.resizeEnded$.pipe(takeUntil(this.ngDestroy$)).subscribe(e => {
            if (e.id !== this.note._id) { return; }
            this.isDragging = false;
            this.localLayout = e.layout;
            this.applyLayoutDirect(e.layout);
        });

        this.interaction.dragState$.pipe(takeUntil(this.ngDestroy$)).subscribe(s => {
            this.amBeingDragged = s.active && s.draggedIds.includes(this.note._id as string);
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
        if (changes['note']) {
            if (!this.isDragging)    { this.localLayout  = { ...this.note.layout }; }
            if (!this.editingTitle)  { this.localTitle   = this.note.title; }
            if (!this.editingDetails){ this.localDetails = this.note.details; }
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
        this.noteEdited$.emit({ title: this.localTitle, details: this.localDetails });
    }

    cancelTitle(): void {
        this.editingTitle = false;
        this.localTitle = this.note.title;
    }

    // --- Inline details editing ---

    startEditDetails(e: MouseEvent): void {
        e.stopPropagation();
        this.editingDetails = true;
    }

    onDetailsCommit(markdown: string): void {
        this.editingDetails = false;
        this.localDetails = markdown;
        this.noteEdited$.emit({ title: this.localTitle, details: markdown });
    }

    cancelDetails(): void {
        this.editingDetails = false;
        this.localDetails = this.note.details;
    }

    // --- Card interaction ---

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
        e.stopPropagation();
        this.selected$.emit(this.note);
        this.dragStarted$.emit(e as unknown as PointerEvent);
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
    }

    onContextMenu(e: MouseEvent): void {
        e.preventDefault();
        e.stopPropagation();
        this.contextMenu$.emit(e);
    }

    readonly resizeHandles: ResizeHandle[] = ['nw','n','ne','e','se','s','sw','w'];
}
