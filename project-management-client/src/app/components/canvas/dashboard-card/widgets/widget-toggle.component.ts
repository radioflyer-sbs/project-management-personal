import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { DashboardWidget } from '../../../../../model/shared-models/dashboard.model';
import { DataDefinition } from '../../../../../model/shared-models/data-definition.model';

@Component({
    selector: 'app-widget-toggle',
    standalone: true,
    imports: [CommonModule, FormsModule, ToggleButtonModule],
    template: `
        <div class="widget widget--toggle">
            <div class="widget__header" *ngIf="widget.label || widget.icon">
                <i *ngIf="widget.icon" class="pi {{ widget.icon }}"></i>
                <span *ngIf="widget.label" class="widget__label">{{ widget.label }}</span>
            </div>
            <div class="widget__body">
                <p-toggleButton
                    [(ngModel)]="toggleValue"
                    [onLabel]="onLabel"
                    [offLabel]="offLabel"
                    [disabled]="!widget.editable"
                    (onChange)="valueChanged.emit($event.checked)">
                </p-toggleButton>
            </div>
        </div>
    `,
})
export class WidgetToggleComponent {
    @Input() widget!: DashboardWidget;
    @Input() dataDef: DataDefinition | undefined;
    @Output() valueChanged = new EventEmitter<boolean>();

    get toggleValue(): boolean { return !!this.dataDef?.value; }
    set toggleValue(_v: boolean) { /* handled via onChange */ }

    get onLabel(): string { return 'On'; }
    get offLabel(): string { return 'Off'; }
}
