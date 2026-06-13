import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardWidget } from '../../../../../model/shared-models/dashboard.model';
import { DataDefinition } from '../../../../../model/shared-models/data-definition.model';

@Component({
    selector: 'app-widget-gauge',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="widget widget--gauge">
            <div class="widget__header" *ngIf="widget.label || widget.icon">
                <i *ngIf="widget.icon" class="pi {{ widget.icon }}"></i>
                <span *ngIf="widget.label" class="widget__label">{{ widget.label }}</span>
            </div>
            <div class="widget__body">
                <svg class="widget__gauge-svg" viewBox="0 0 100 60">
                    <path class="widget__gauge-track"
                        d="M 10 55 A 40 40 0 0 1 90 55"
                        fill="none" stroke-width="8" stroke-linecap="round"/>
                    <path class="widget__gauge-fill"
                        d="M 10 55 A 40 40 0 0 1 90 55"
                        fill="none" stroke-width="8" stroke-linecap="round"
                        [attr.stroke-dasharray]="dashArray"
                        [attr.stroke-dashoffset]="dashOffset"/>
                </svg>
                <div class="widget__gauge-label">
                    <span class="widget__value">{{ displayValue }}</span>
                    <span class="widget__unit" *ngIf="dataDef?.options?.unit">{{ dataDef!.options!.unit }}</span>
                </div>
            </div>
        </div>
    `,
})
export class WidgetGaugeComponent {
    @Input() widget!: DashboardWidget;
    @Input() dataDef: DataDefinition | undefined;

    private readonly ARC_LENGTH = 125.66; // π * r (r=40) for semicircle

    get min(): number { return this.dataDef?.options?.min ?? 0; }
    get max(): number { return this.dataDef?.options?.max ?? 100; }

    get currentValue(): number {
        return typeof this.dataDef?.value === 'number' ? this.dataDef.value : this.min;
    }

    get displayValue(): string {
        return typeof this.dataDef?.value === 'number' ? String(this.dataDef.value) : '—';
    }

    get fraction(): number {
        const range = this.max - this.min;
        if (range === 0) { return 0; }
        return Math.max(0, Math.min(1, (this.currentValue - this.min) / range));
    }

    get dashArray(): string { return `${this.ARC_LENGTH} ${this.ARC_LENGTH}`; }
    get dashOffset(): number { return this.ARC_LENGTH * (1 - this.fraction); }
}
