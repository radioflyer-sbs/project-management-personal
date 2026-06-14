import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardWidget } from '../../../../../model/shared-models/dashboard.model';
import { DataDefinition } from '../../../../../model/shared-models/data-definition.model';

@Component({
    selector: 'app-widget-progress',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="widget widget--progress">
            <div class="widget__header" *ngIf="widget.label || widget.icon">
                <i *ngIf="widget.icon" class="pi {{ widget.icon }}"></i>
                <span *ngIf="widget.label" class="widget__label">{{ widget.label }}</span>
                <span class="widget__pct">{{ percent }}%</span>
            </div>
            <div class="widget__body">
                <div class="widget__progress-track">
                    <div class="widget__progress-fill" [style.width.%]="percent"></div>
                </div>
            </div>
        </div>
    `,
})
export class WidgetProgressComponent {
    @Input() widget!: DashboardWidget;
    @Input() dataDef: DataDefinition | undefined;
    @Output() valueChanged = new EventEmitter<number>();

    get min(): number { return this.dataDef?.options?.min ?? 0; }
    get max(): number { return this.dataDef?.options?.max ?? 100; }

    get currentValue(): number {
        return typeof this.dataDef?.value === 'number' ? this.dataDef.value : this.min;
    }

    get percent(): number {
        const range = this.max - this.min;
        if (range === 0) { return 0; }
        return Math.round(Math.max(0, Math.min(100, ((this.currentValue - this.min) / range) * 100)));
    }
}
