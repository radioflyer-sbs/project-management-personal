import { Component, Input, Output, EventEmitter, inject, OnInit, OnChanges, SimpleChanges, NgZone, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { ComponentBase } from '../../component-base/component-base.component';
import { CanvasInteractionService, ResizeHandle } from '../../../services/canvas-interaction.service';
import { Group } from '../../../../model/shared-models/group.model';
import { Layout } from '../../../../model/shared-models/layout.model';

@Component({
    selector: 'app-group-card',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './group-card.component.html',
    styleUrl: './group-card.component.scss',
})
export class GroupCardComponent extends ComponentBase implements OnInit, OnChanges {

    constructor() { super(); }

    @Input({ required: true }) group!: Group;
    @Input() containedItems: Array<{ id: string; isTask: boolean; layout: Layout }> = [];
    @Input() selected = false;

    @Output() selected$           = new EventEmitter<Group>();
    @Output() titleChanged$       = new EventEmitter<string>();
    @Output() layoutConfigChanged$ = new EventEmitter<{ direction: 'vertical' | 'horizontal'; wrap: boolean }>();

    private readonly interaction = inject(CanvasInteractionService);
    private readonly zone        = inject(NgZone);
    private readonly el          = inject(ElementRef<HTMLElement>);

    localLayout!: Layout;
    editingTitle  = false;
    localTitle    = '';

    ngOnInit(): void {
        this.zone.runOutsideAngular(() => {
            this.interaction.moveDragging$.pipe(takeUntil(this.ngDestroy$)).subscribe(e => {
                if ((e.id as any) !== (this.group._id as any)) { return; }
                this.localLayout = e.layout;
                this.applyLayoutDirect(e.layout);
            });
            this.interaction.resizeDragging$.pipe(takeUntil(this.ngDestroy$)).subscribe(e => {
                if ((e.id as any) !== (this.group._id as any)) { return; }
                this.localLayout = e.layout;
                this.applyLayoutDirect(e.layout);
            });
        });

        this.interaction.moveEnded$.pipe(takeUntil(this.ngDestroy$)).subscribe(e => {
            if ((e.id as any) !== (this.group._id as any)) { return; }
            this.localLayout = e.layout;
            this.applyLayoutDirect(e.layout);
        });
        this.interaction.resizeEnded$.pipe(takeUntil(this.ngDestroy$)).subscribe(e => {
            if ((e.id as any) !== (this.group._id as any)) { return; }
            this.localLayout = e.layout;
            this.applyLayoutDirect(e.layout);
        });
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['group']) {
            this.localLayout = { ...this.group.layout };
            if (!this.editingTitle) { this.localTitle = this.group.title; }
        }
    }

    private applyLayoutDirect(l: Layout): void {
        const div = this.el.nativeElement.firstElementChild as HTMLElement;
        if (!div) { return; }
        div.style.left   = `${l.x}px`;
        div.style.top    = `${l.y}px`;
        div.style.width  = `${l.width}px`;
        div.style.height = `${l.height}px`;
    }

    get cardStyle(): Record<string, string> {
        const l = this.localLayout ?? this.group.layout;
        return {
            left:   `${l.x}px`,
            top:    `${l.y}px`,
            width:  `${l.width}px`,
            height: `${l.height}px`,
            zIndex: `${l.zIndex}`,
        };
    }

    onTitleBarMousedown(e: MouseEvent): void {
        if (e.button !== 0 || this.editingTitle) { return; }
        this.selected$.emit(this.group);
        this.interaction.startMoveGroup(
            e as unknown as PointerEvent,
            this.group._id as string,
            this.localLayout ?? this.group.layout,
            this.containedItems,
        );
    }

    onTitleDblclick(e: MouseEvent): void {
        e.stopPropagation();
        this.editingTitle = true;
        this.localTitle   = this.group.title;
    }

    commitTitle(): void {
        this.editingTitle = false;
        if (this.localTitle.trim() && this.localTitle !== this.group.title) {
            this.titleChanged$.emit(this.localTitle.trim());
        } else {
            this.localTitle = this.group.title;
        }
    }

    cancelTitle(): void {
        this.editingTitle = false;
        this.localTitle   = this.group.title;
    }

    onCardClick(e: MouseEvent): void {
        e.stopPropagation();
    }

    onResizeMousedown(e: MouseEvent, handle: ResizeHandle): void {
        e.stopPropagation();
        this.selected$.emit(this.group);
        this.interaction.startResizeGroup(
            e as unknown as PointerEvent,
            this.group._id as string,
            handle,
            this.localLayout ?? this.group.layout,
        );
    }

    get resizeHandles(): ResizeHandle[] {
        const dir  = this.group?.layoutDirection ?? 'vertical';
        const wrap = this.group?.layoutWrap ?? false;
        return (dir === 'horizontal' && !wrap) ? ['n', 's'] : ['e', 'w'];
    }

    setLayoutConfig(direction: 'vertical' | 'horizontal', wrap: boolean, e: MouseEvent): void {
        e.stopPropagation();
        this.layoutConfigChanged$.emit({ direction, wrap });
    }

    get layoutMode(): 'vertical' | 'horizontal' | 'wrap' {
        const dir  = this.group?.layoutDirection ?? 'vertical';
        const wrap = this.group?.layoutWrap ?? false;
        if (dir === 'horizontal' && wrap) { return 'wrap'; }
        return dir === 'horizontal' ? 'horizontal' : 'vertical';
    }
}
