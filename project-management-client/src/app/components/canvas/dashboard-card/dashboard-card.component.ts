import {
    Component, Input, Output, EventEmitter, inject, OnInit, OnChanges, SimpleChanges,
    NgZone, ElementRef, ViewContainerRef, ComponentRef, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { DialogModule } from 'primeng/dialog';
import { CheckboxModule } from 'primeng/checkbox';
import { TooltipModule } from 'primeng/tooltip';
import { ComponentBase } from '../../component-base/component-base.component';
import { CanvasInteractionService } from '../../../services/canvas-interaction.service';
import { DataDefinitionApiClient } from '../../../services/api-clients/data-definition-api.client';
import { DashboardApiClient } from '../../../services/api-clients/dashboard-api.client';
import { Dashboard, DashboardWidget, DashboardWidgetType, DashboardConfig } from '../../../../model/shared-models/dashboard.model';
import { DataDefinition, DataValue, DataValueType } from '../../../../model/shared-models/data-definition.model';
import { Layout } from '../../../../model/shared-models/layout.model';
import { WIDGET_REGISTRY, WIDGET_TYPE_OPTIONS } from './widget-registry';
import { WidgetNumberComponent } from './widgets/widget-number.component';
import { WidgetProgressComponent } from './widgets/widget-progress.component';
import { WidgetStatusComponent } from './widgets/widget-status.component';
import { WidgetTextComponent } from './widgets/widget-text.component';
import { WidgetListComponent } from './widgets/widget-list.component';
import { WidgetToggleComponent } from './widgets/widget-toggle.component';
import { WidgetGaugeComponent } from './widgets/widget-gauge.component';

@Component({
    selector: 'app-dashboard-card',
    standalone: true,
    imports: [
        CommonModule, FormsModule,
        ButtonModule, InputTextModule, DropdownModule, DialogModule, CheckboxModule, TooltipModule,
        WidgetNumberComponent, WidgetProgressComponent, WidgetStatusComponent,
        WidgetTextComponent, WidgetListComponent, WidgetToggleComponent, WidgetGaugeComponent,
    ],
    templateUrl: './dashboard-card.component.html',
    styleUrl: './dashboard-card.component.scss',
})
export class DashboardCardComponent extends ComponentBase implements OnInit, OnChanges {

    constructor() { super(); }

    @Input({ required: true }) dashboard!: Dashboard;
    @Input() projectId!: string;
    @Input() selected = false;

    @Output() selected$        = new EventEmitter<Dashboard>();
    @Output() dragStarted$     = new EventEmitter<PointerEvent>();
    @Output() resizeStarted$   = new EventEmitter<{ handle: string; e: PointerEvent }>();
    @Output() dashboardUpdated$ = new EventEmitter<Dashboard>();
    @Output() dashboardDeleted$ = new EventEmitter<string>();

    @ViewChild('widgetsContainer', { read: ViewContainerRef }) widgetVCR!: ViewContainerRef;

    private readonly interaction    = inject(CanvasInteractionService);
    private readonly zone           = inject(NgZone);
    private readonly el             = inject(ElementRef<HTMLElement>);
    private readonly dataDefApi     = inject(DataDefinitionApiClient);
    private readonly dashboardApi   = inject(DashboardApiClient);

    localLayout!: Layout;
    private isDragging = false;

    dataDefs: DataDefinition[] = [];
    private widgetRefs: ComponentRef<any>[] = [];

    // Setup dialog
    showSetupDialog = false;
    newWidgetType: DashboardWidgetType = DashboardWidgetType.Number;
    newWidgetLabel = '';
    newWidgetIcon = '';
    newWidgetId = '';
    newWidgetDataId = '';
    newWidgetEditable = false;
    widgetTypeOptions = WIDGET_TYPE_OPTIONS;

    // Data definition creation within setup
    showNewDefForm = false;
    newDefId = '';
    newDefLabel = '';
    newDefValueType: DataValueType = 'number';
    newDefValue: string = '0';
    valueTypeOptions: Array<{ label: string; value: DataValueType }> = [
        { label: 'Number',    value: 'number' },
        { label: 'Text',      value: 'text' },
        { label: 'Boolean',   value: 'boolean' },
        { label: 'Enum',      value: 'enum' },
        { label: 'Timestamp', value: 'timestamp' },
        { label: 'List',      value: 'list' },
    ];

    ngOnInit(): void {
        this.localLayout = { ...this.dashboard.layout };
        this.loadDataDefs();

        this.zone.runOutsideAngular(() => {
            this.interaction.moveDragging$.pipe(takeUntil(this.ngDestroy$)).subscribe(e => {
                if ((e.id as any) !== (this.dashboard._id as any)) { return; }
                if (!e.hasMoved) { return; }
                this.isDragging = true;
                this.localLayout = e.layout;
                this.applyLayoutDirect(e.layout);
            });
        });

        this.interaction.resizeDragging$.pipe(takeUntil(this.ngDestroy$)).subscribe(e => {
            if ((e.id as any) !== (this.dashboard._id as any)) { return; }
            this.localLayout = e.layout;
            this.applyLayoutDirect(e.layout);
        });
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['dashboard'] && !this.isDragging) {
            this.localLayout = { ...this.dashboard.layout };
            this.applyLayoutDirect(this.localLayout);
        }
        if (changes['projectId'] && this.projectId) {
            this.loadDataDefs();
        }
    }

    private loadDataDefs(): void {
        if (!this.projectId) { return; }
        this.dataDefApi.getByProject(this.projectId).subscribe(defs => {
            this.dataDefs = defs;
        });
    }

    private applyLayoutDirect(layout: Layout): void {
        const el = this.el.nativeElement as HTMLElement;
        el.style.left   = `${layout.x}px`;
        el.style.top    = `${layout.y}px`;
        el.style.width  = `${layout.width}px`;
        el.style.height = `${layout.height}px`;
        el.style.zIndex = String(layout.zIndex);
    }

    getWidgetComponent(type: DashboardWidgetType): any {
        return WIDGET_REGISTRY[type];
    }

    getDataDef(dataId: string): DataDefinition | undefined {
        return this.dataDefs.find(d => d.id === dataId);
    }

    onWidgetValueChanged(widget: DashboardWidget, value: DataValue): void {
        this.dataDefApi.setValue(this.projectId, widget.dataId, value).subscribe(updated => {
            this.dataDefs = this.dataDefs.map(d => d.id === updated.id ? updated : d);
        });
    }

    openSetup(): void {
        this.resetNewWidgetForm();
        this.showSetupDialog = true;
    }

    closeSetup(): void {
        this.showSetupDialog = false;
        this.showNewDefForm = false;
    }

    private resetNewWidgetForm(): void {
        this.newWidgetType     = DashboardWidgetType.Number;
        this.newWidgetLabel    = '';
        this.newWidgetIcon     = '';
        this.newWidgetId       = '';
        this.newWidgetDataId   = '';
        this.newWidgetEditable = false;
        this.showNewDefForm    = false;
    }

    addWidget(): void {
        if (!this.newWidgetId || !this.newWidgetDataId) { return; }

        const exists = this.dashboard.config.widgets.some(w => w.id === this.newWidgetId);
        if (exists) { alert(`Widget id '${this.newWidgetId}' already exists in this dashboard.`); return; }

        const defExists = this.dataDefs.some(d => d.id === this.newWidgetDataId);
        if (!defExists) { alert(`Data definition '${this.newWidgetDataId}' not found.`); return; }

        const newWidget: DashboardWidget = {
            id:       this.newWidgetId,
            dataId:   this.newWidgetDataId,
            type:     this.newWidgetType,
            label:    this.newWidgetLabel || undefined,
            icon:     this.newWidgetIcon  || undefined,
            editable: this.newWidgetEditable,
        };

        const updated: DashboardConfig = {
            widgets: [...this.dashboard.config.widgets, newWidget],
        };

        this.dashboardApi.update(this.dashboard._id as string, { config: updated }).subscribe(result => {
            this.dashboardUpdated$.emit(result);
            this.resetNewWidgetForm();
        });
    }

    removeWidget(widgetId: string): void {
        const updated: DashboardConfig = {
            widgets: this.dashboard.config.widgets.filter(w => w.id !== widgetId),
        };
        this.dashboardApi.update(this.dashboard._id as string, { config: updated }).subscribe(result => {
            this.dashboardUpdated$.emit(result);
        });
    }

    createDataDef(): void {
        if (!this.newDefId) { return; }
        let parsedValue: DataValue = this.newDefValue;
        if (this.newDefValueType === 'number') { parsedValue = parseFloat(this.newDefValue) || 0; }
        if (this.newDefValueType === 'boolean') { parsedValue = this.newDefValue === 'true'; }
        if (this.newDefValueType === 'list') { parsedValue = []; }

        this.dataDefApi.create({
            projectId: this.projectId,
            id:        this.newDefId,
            label:     this.newDefLabel || undefined,
            valueType: this.newDefValueType,
            value:     parsedValue,
        }).subscribe({
            next: def => {
                this.dataDefs = [...this.dataDefs, def];
                this.newWidgetDataId = def.id;
                this.showNewDefForm = false;
                this.newDefId = '';
                this.newDefLabel = '';
            },
            error: err => {
                if (err.status === 409) {
                    alert(`Data definition id '${this.newDefId}' already exists in this project.`);
                }
            },
        });
    }

    deleteDashboard(): void {
        this.dashboardDeleted$.emit(this.dashboard._id as string);
    }

    onMousedown(e: MouseEvent): void {
        if (e.button !== 0) { return; }
        e.stopPropagation();
        this.selected$.emit(this.dashboard);
        this.dragStarted$.emit(e as unknown as PointerEvent);
    }

    onResizeMousedown(handle: string, e: MouseEvent): void {
        e.stopPropagation();
        this.resizeStarted$.emit({ handle, e: e as unknown as PointerEvent });
    }

    get dataDefOptions(): Array<{ label: string; value: string }> {
        return this.dataDefs.map(d => ({ label: `${d.id}${d.label ? ' — ' + d.label : ''}`, value: d.id }));
    }
}
