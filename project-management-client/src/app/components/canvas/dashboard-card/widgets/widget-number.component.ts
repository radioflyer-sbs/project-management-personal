import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardWidget } from '../../../../../model/shared-models/dashboard.model';
import { DataDefinition } from '../../../../../model/shared-models/data-definition.model';

@Component({
    selector: 'app-widget-number',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="widget widget--number">
            <div class="widget__header" *ngIf="widget.label || widget.icon">
                <i *ngIf="widget.icon" class="pi {{ widget.icon }}"></i>
                <span *ngIf="widget.label" class="widget__label">{{ widget.label }}</span>
            </div>
            <div class="widget__body">
                <span class="widget__value">
                    {{ widget.options?.prefix }}{{ displayValue }}{{ dataDef?.options?.unit || widget.options?.suffix }}
                </span>
            </div>
        </div>
    `,
})
export class WidgetNumberComponent {
    @Input() widget!: DashboardWidget;
    @Input() dataDef: DataDefinition | undefined;
    @Output() valueChanged = new EventEmitter<number>();

    get displayValue(): string {
        const v = this.dataDef?.value;
        return v !== null && v !== undefined ? String(v) : '—';
    }
}
