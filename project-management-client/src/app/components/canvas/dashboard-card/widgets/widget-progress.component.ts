import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardWidget } from '../../../../../model/shared-models/dashboard.model';
import { DataDefinition } from '../../../../../model/shared-models/data-definition.model';

@Component({
    selector: 'app-widget-progress',
    standalone: true,
    imports: [CommonModule, FormsModule],
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
                <input *ngIf="widget.editable"
                    type="range"
                    class="widget__range"
                    [min]="min" [max]="max" [step]="step"
                    [value]="localValue"
                    (input)="onInput($event)"
                    (change)="onCommit($event)"
                    (mousedown)="$event.stopPropagation()" />
            </div>
        </div>
    `,
})
export class WidgetProgressComponent implements OnChanges {
    @Input() widget!: DashboardWidget;
    @Input() dataDef: DataDefinition | undefined;
    @Output() valueChanged = new EventEmitter<number>();

    localValue = 0;

    get min(): number { return this.dataDef?.options?.min ?? 0; }
    get max(): number { return this.dataDef?.options?.max ?? 100; }
    get step(): number { return 1; }

    get currentValue(): number {
        return typeof this.dataDef?.value === 'number' ? this.dataDef.value : this.min;
    }

    get percent(): number {
        const range = this.max - this.min;
        if (range === 0) { return 0; }
        return Math.round(Math.max(0, Math.min(100, ((this.localValue - this.min) / range) * 100)));
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['dataDef']) {
            this.localValue = this.currentValue;
        }
    }

    onInput(e: Event): void {
        this.localValue = Number((e.target as HTMLInputElement).value);
    }

    onCommit(e: Event): void {
        const v = Number((e.target as HTMLInputElement).value);
        this.localValue = v;
        this.valueChanged.emit(v);
    }
}
