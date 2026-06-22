import { Component, HostBinding, HostListener, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntil } from 'rxjs/operators';
import { ComponentBase } from '../component-base/component-base.component';
import { SelectionService, SelectedItem } from '../../services/selection.service';

@Component({
    selector: 'app-reading-pane',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './reading-pane.component.html',
    styleUrl: './reading-pane.component.scss',
})
export class ReadingPaneComponent extends ComponentBase implements OnInit {

    constructor() { super(); }

    private readonly selection = inject(SelectionService);

    title = '';
    body  = '';
    hasContent = false;

    private resizing        = false;
    private resizeStartX    = 0;
    private resizeStartWidth = 0;
    width = 300;
    readonly minWidth = 180;
    readonly maxWidth = 700;

    @HostBinding('style.width') get hostWidth() { return `${this.width}px`; }

    ngOnInit(): void {
        this.selection.currentSelection$
            .pipe(takeUntil(this.ngDestroy$))
            .subscribe(sel => this.applySelection(sel));
    }

    private applySelection(sel: SelectedItem): void {
        if (!sel) {
            this.title      = '';
            this.body       = '';
            this.hasContent = false;
            return;
        }
        switch (sel.type) {
            case 'task':
                this.title      = sel.item.title;
                this.body       = sel.item.description ?? '';
                this.hasContent = true;
                break;
            case 'note':
                this.title      = sel.item.title;
                this.body       = sel.item.details ?? '';
                this.hasContent = true;
                break;
            case 'project':
                this.title      = sel.item.name;
                this.body       = sel.item.description ?? '';
                this.hasContent = true;
                break;
            default:
                this.title      = '';
                this.body       = '';
                this.hasContent = false;
        }
    }

    onResizeStart(event: MouseEvent): void {
        this.resizing         = true;
        this.resizeStartX     = event.clientX;
        this.resizeStartWidth = this.width;
        document.body.style.userSelect = 'none';
        document.body.style.cursor     = 'col-resize';
        event.preventDefault();
    }

    @HostListener('document:mousemove', ['$event'])
    onMouseMove(event: MouseEvent): void {
        if (!this.resizing) { return; }
        const delta = event.clientX - this.resizeStartX;
        this.width = Math.max(this.minWidth, Math.min(this.maxWidth, this.resizeStartWidth + delta));
    }

    @HostListener('document:mouseup')
    onMouseUp(): void {
        if (!this.resizing) { return; }
        this.resizing = false;
        document.body.style.userSelect = '';
        document.body.style.cursor     = '';
    }
}
