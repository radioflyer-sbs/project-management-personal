import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ContextMenuItem {
    label: string;
    icon?: string;
    action: string;
    separator?: boolean;
}

@Component({
    selector: 'app-canvas-context-menu',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './canvas-context-menu.component.html',
    styleUrl: './canvas-context-menu.component.scss',
})
export class CanvasContextMenuComponent {

    constructor() { }

    @Input() items: ContextMenuItem[] = [];
    @Input() visible = false;
    @Input() x = 0;
    @Input() y = 0;

    @Output() itemClicked$ = new EventEmitter<string>();
    @Output() dismissed$   = new EventEmitter<void>();

    @HostListener('document:mousedown', ['$event'])
    onDocumentMousedown(e: MouseEvent): void {
        if (this.visible) {
            this.dismissed$.emit();
        }
    }

    onItemClick(action: string, event: MouseEvent): void {
        event.stopPropagation();
        this.itemClicked$.emit(action);
    }
}
