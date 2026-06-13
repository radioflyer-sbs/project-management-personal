import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { DashboardWidget } from '../../../../../model/shared-models/dashboard.model';
import { DataDefinition } from '../../../../../model/shared-models/data-definition.model';

@Component({
    selector: 'app-widget-number',
    standalone: true,
    imports: [CommonModule, FormsModule, InputNumberModule],
    template: `
        <div class="widget widget--number">
            <div class="widget__header" *ngIf="widget.label || widget.icon">
                <i *ngIf="widget.icon" class="pi {{ widget.icon }}"></i>
                <span *ngIf="widget.label" class="widget__label">{{ widget.label }}</span>
            </div>
            <div class="widget__body">
                <ng-container *ngIf="!editing">
                    <span class="widget__value">
                        {{ widget.options?.prefix }}{{ displayValue }}{{ dataDef?.options?.unit || widget.options?.suffix }}
                    </span>
                    <button *ngIf="widget.editable" class="widget__edit-btn pi pi-pencil" (click)="startEdit()"></button>
                </ng-container>
                <ng-container *ngIf="editing">
                    <input pInputNumber [(ngModel)]="editValue" class="widget__input" (keydown.enter)="commitEdit()" (keydown.escape)="cancelEdit()" />
                    <button class="widget__edit-btn pi pi-check" (click)="commitEdit()"></button>
                    <button class="widget__edit-btn pi pi-times" (click)="cancelEdit()"></button>
                </ng-container>
            </div>
        </div>
    `,
})
export class WidgetNumberComponent {
    @Input() widget!: DashboardWidget;
    @Input() dataDef: DataDefinition | undefined;
    @Output() valueChanged = new EventEmitter<number>();

    editing = false;
    editValue: number = 0;

    get displayValue(): string {
        const v = this.dataDef?.value;
        return v !== null && v !== undefined ? String(v) : '—';
    }

    startEdit(): void {
        this.editValue = typeof this.dataDef?.value === 'number' ? this.dataDef.value : 0;
        this.editing = true;
    }

    commitEdit(): void {
        this.editing = false;
        this.valueChanged.emit(this.editValue);
    }

    cancelEdit(): void { this.editing = false; }
}
