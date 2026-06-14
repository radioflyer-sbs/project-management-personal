import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardWidget } from '../../../../../model/shared-models/dashboard.model';
import { DataDefinition } from '../../../../../model/shared-models/data-definition.model';

@Component({
    selector: 'app-widget-list',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="widget widget--list">
            <div class="widget__header" *ngIf="widget.label || widget.icon">
                <i *ngIf="widget.icon" class="pi {{ widget.icon }}"></i>
                <span *ngIf="widget.label" class="widget__label">{{ widget.label }}</span>
            </div>
            <div class="widget__body">
                <ul class="widget__list">
                    <li *ngFor="let item of listItems" class="widget__list-item">
                        <span>{{ item }}</span>
                    </li>
                    <li *ngIf="listItems.length === 0" class="widget__list-empty">—</li>
                </ul>
            </div>
        </div>
    `,
})
export class WidgetListComponent {
    @Input() widget!: DashboardWidget;
    @Input() dataDef: DataDefinition | undefined;
    @Output() valueChanged = new EventEmitter<string[]>();

    get listItems(): string[] {
        const v = this.dataDef?.value;
        return Array.isArray(v) ? v : [];
    }
}
