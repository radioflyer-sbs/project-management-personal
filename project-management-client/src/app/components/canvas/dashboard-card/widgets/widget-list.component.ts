import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { DashboardWidget } from '../../../../../model/shared-models/dashboard.model';
import { DataDefinition } from '../../../../../model/shared-models/data-definition.model';

@Component({
    selector: 'app-widget-list',
    standalone: true,
    imports: [CommonModule, FormsModule, InputTextModule, ButtonModule],
    template: `
        <div class="widget widget--list">
            <div class="widget__header" *ngIf="widget.label || widget.icon">
                <i *ngIf="widget.icon" class="pi {{ widget.icon }}"></i>
                <span *ngIf="widget.label" class="widget__label">{{ widget.label }}</span>
            </div>
            <div class="widget__body">
                <ul class="widget__list">
                    <li *ngFor="let item of listItems; let i = index" class="widget__list-item">
                        <span>{{ item }}</span>
                        <button *ngIf="widget.editable" class="widget__edit-btn pi pi-times"
                            (click)="removeItem(i)"></button>
                    </li>
                    <li *ngIf="listItems.length === 0" class="widget__list-empty">—</li>
                </ul>
                <div *ngIf="widget.editable" class="widget__list-add">
                    <input pInputText [(ngModel)]="newItem" placeholder="Add item…"
                        (keydown.enter)="addItem()" class="widget__input" />
                    <button pButton icon="pi pi-plus" (click)="addItem()"></button>
                </div>
            </div>
        </div>
    `,
})
export class WidgetListComponent {
    @Input() widget!: DashboardWidget;
    @Input() dataDef: DataDefinition | undefined;
    @Output() valueChanged = new EventEmitter<string[]>();

    newItem = '';

    get listItems(): string[] {
        const v = this.dataDef?.value;
        return Array.isArray(v) ? v : [];
    }

    addItem(): void {
        const trimmed = this.newItem.trim();
        if (!trimmed) { return; }
        this.newItem = '';
        this.valueChanged.emit([...this.listItems, trimmed]);
    }

    removeItem(index: number): void {
        const updated = this.listItems.filter((_, i) => i !== index);
        this.valueChanged.emit(updated);
    }
}
