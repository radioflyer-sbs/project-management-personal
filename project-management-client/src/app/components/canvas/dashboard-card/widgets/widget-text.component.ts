import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardWidget } from '../../../../../model/shared-models/dashboard.model';
import { DataDefinition } from '../../../../../model/shared-models/data-definition.model';

@Component({
    selector: 'app-widget-text',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="widget widget--text">
            <div class="widget__header" *ngIf="widget.label || widget.icon">
                <i *ngIf="widget.icon" class="pi {{ widget.icon }}"></i>
                <span *ngIf="widget.label" class="widget__label">{{ widget.label }}</span>
            </div>
            <div class="widget__body">
                <span class="widget__value widget__value--text">{{ displayValue }}</span>
            </div>
        </div>
    `,
})
export class WidgetTextComponent {
    @Input() widget!: DashboardWidget;
    @Input() dataDef: DataDefinition | undefined;
    @Output() valueChanged = new EventEmitter<string>();

    get displayValue(): string {
        const v = this.dataDef?.value;
        return v !== null && v !== undefined ? String(v) : '—';
    }
}
