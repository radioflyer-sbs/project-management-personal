import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardWidget } from '../../../../../model/shared-models/dashboard.model';
import { DataDefinition } from '../../../../../model/shared-models/data-definition.model';

@Component({
    selector: 'app-widget-toggle',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="widget widget--toggle">
            <div class="widget__header" *ngIf="widget.label || widget.icon">
                <i *ngIf="widget.icon" class="pi {{ widget.icon }}"></i>
                <span *ngIf="widget.label" class="widget__label">{{ widget.label }}</span>
            </div>
            <div class="widget__body">
                <span class="widget__toggle-badge"
                    [class.widget__toggle-badge--on]="isOn"
                    [class.widget__toggle-badge--off]="!isOn">
                    {{ isOn ? 'On' : 'Off' }}
                </span>
            </div>
        </div>
    `,
})
export class WidgetToggleComponent {
    @Input() widget!: DashboardWidget;
    @Input() dataDef: DataDefinition | undefined;
    @Output() valueChanged = new EventEmitter<boolean>();

    get isOn(): boolean { return !!this.dataDef?.value; }
}
