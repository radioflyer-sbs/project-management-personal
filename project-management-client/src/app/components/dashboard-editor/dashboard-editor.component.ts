import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntil } from 'rxjs/operators';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { CheckboxModule } from 'primeng/checkbox';
import { TooltipModule } from 'primeng/tooltip';
import { ComponentBase } from '../component-base/component-base.component';
import { DashboardApiClient } from '../../services/api-clients/dashboard-api.client';
import { DataDefinitionApiClient } from '../../services/api-clients/data-definition-api.client';
import { Dashboard, DashboardWidget, DashboardWidgetType } from '../../../model/shared-models/dashboard.model';
import { DataDefinition, DataValue, DataValueType } from '../../../model/shared-models/data-definition.model';
import { WIDGET_TYPE_OPTIONS } from '../canvas/dashboard-card/widget-registry';

export interface DraftWidget {
    id: string;
    type: DashboardWidgetType;
    dataId: string;
    label: string;
    icon: string;
    editable: boolean;
    prefix: string;
    suffix: string;
}

@Component({
    selector: 'app-dashboard-editor',
    standalone: true,
    imports: [
        CommonModule, FormsModule,
        ButtonModule, InputTextModule, DropdownModule, CheckboxModule, TooltipModule,
    ],
    templateUrl: './dashboard-editor.component.html',
    styleUrl: './dashboard-editor.component.scss',
})
export class DashboardEditorComponent extends ComponentBase implements OnInit {

    constructor() { super(); }

    private readonly route        = inject(ActivatedRoute);
    private readonly router       = inject(Router);
    private readonly dashboardApi = inject(DashboardApiClient);
    private readonly dataDefApi   = inject(DataDefinitionApiClient);

    loading  = true;
    saving   = false;
    saved    = false;
    isDirty  = false;

    dashboard: Dashboard | null = null;
    projectId = '';
    draftTitle = '';
    draftWidgets: DraftWidget[] = [];
    defs: DataDefinition[] = [];

    readonly widgetTypeOptions = WIDGET_TYPE_OPTIONS;

    // ── Add-widget form ──────────────────────────────────────────────────────
    newWidgetId       = '';
    newWidgetType     = DashboardWidgetType.Number;
    newWidgetDataId   = '';
    newWidgetLabel    = '';
    newWidgetIcon     = '';
    newWidgetEditable = false;

    ngOnInit(): void {
        this.route.params.pipe(takeUntil(this.ngDestroy$)).subscribe(params => {
            this.projectId = params['projectId'] ?? '';
            const dashboardId = params['dashboardId'] ?? '';
            if (this.projectId && dashboardId) {
                this.load(dashboardId);
            }
        });
    }

    private load(dashboardId: string): void {
        this.loading = true;
        this.isDirty = false;
        forkJoin({
            dashboard: this.dashboardApi.getById(dashboardId),
            defs:      this.dataDefApi.getByProject(this.projectId),
        }).pipe(takeUntil(this.ngDestroy$)).subscribe(({ dashboard, defs }) => {
            this.dashboard    = dashboard;
            this.draftTitle   = dashboard.title;
            this.draftWidgets = dashboard.config.widgets.map(w => this.toDraftWidget(w));
            this.defs         = defs;
            this.loading      = false;
        });
    }

    private toDraftWidget(w: DashboardWidget): DraftWidget {
        return {
            id:       w.id,
            type:     w.type,
            dataId:   w.dataId,
            label:    w.label    ?? '',
            icon:     w.icon     ?? '',
            editable: w.editable,
            prefix:   w.options?.prefix ?? '',
            suffix:   w.options?.suffix ?? '',
        };
    }

    navigateBack(): void {
        if (!this.dashboard) { this.router.navigate(['/projects']); return; }
        const pid       = this.dashboard.projectId as string;
        const parentId  = this.dashboard.parentTaskId as string | undefined;
        const ancestors = (this.dashboard.ancestorTaskIds ?? []) as string[];
        if (parentId) {
            this.router.navigate(['/projects', pid, 'tasks', ...ancestors, parentId]);
        } else {
            this.router.navigate(['/projects', pid]);
        }
    }

    navigateToMetrics(): void {
        this.router.navigate(['/projects', this.projectId, 'metrics']);
    }

    markDirty(): void {
        this.isDirty = true;
        this.saved   = false;
    }

    saveDashboard(): void {
        if (!this.dashboard) { return; }
        this.saving = true;
        const widgets = this.draftWidgets.map(w => ({
            id:       w.id,
            type:     w.type,
            dataId:   w.dataId,
            label:    w.label    || undefined,
            icon:     w.icon     || undefined,
            editable: w.editable,
            options:  (w.prefix || w.suffix)
                ? { prefix: w.prefix || undefined, suffix: w.suffix || undefined }
                : undefined,
        }));
        this.dashboardApi.update(this.dashboard._id as string, {
            title:  this.draftTitle,
            config: { widgets },
        }).pipe(takeUntil(this.ngDestroy$)).subscribe(updated => {
            this.dashboard  = updated;
            this.draftTitle = updated.title;
            this.isDirty    = false;
            this.saving     = false;
            this.saved      = true;
            setTimeout(() => this.saved = false, 2500);
        });
    }

    moveWidget(index: number, dir: -1 | 1): void {
        const next = index + dir;
        if (next < 0 || next >= this.draftWidgets.length) { return; }
        const arr = [...this.draftWidgets];
        [arr[index], arr[next]] = [arr[next], arr[index]];
        this.draftWidgets = arr;
        this.markDirty();
    }

    removeWidget(index: number): void {
        this.draftWidgets = this.draftWidgets.filter((_, i) => i !== index);
        this.markDirty();
    }

    addWidget(): void {
        if (!this.newWidgetId || !this.newWidgetDataId) { return; }
        if (this.draftWidgets.some(w => w.id === this.newWidgetId)) {
            alert(`Widget id '${this.newWidgetId}' already exists in this dashboard.`);
            return;
        }
        this.draftWidgets = [...this.draftWidgets, {
            id:       this.newWidgetId,
            type:     this.newWidgetType,
            dataId:   this.newWidgetDataId,
            label:    this.newWidgetLabel,
            icon:     this.newWidgetIcon,
            editable: this.newWidgetEditable,
            prefix:   '',
            suffix:   '',
        }];
        this.newWidgetId       = '';
        this.newWidgetDataId   = '';
        this.newWidgetLabel    = '';
        this.newWidgetIcon     = '';
        this.newWidgetEditable = false;
        this.markDirty();
    }

    onNewWidgetDataIdChange(dataId: string): void {
        const def = this.defs.find(d => d.id === dataId);
        if (!def) { return; }
        this.newWidgetType = this.suggestedWidgetType(def.valueType);
    }

    private suggestedWidgetType(valueType: DataValueType): DashboardWidgetType {
        switch (valueType) {
            case 'number':    return DashboardWidgetType.Number;
            case 'text':      return DashboardWidgetType.Text;
            case 'boolean':   return DashboardWidgetType.Toggle;
            case 'enum':      return DashboardWidgetType.Status;
            case 'list':      return DashboardWidgetType.List;
            case 'timestamp': return DashboardWidgetType.Text;
            default:          return DashboardWidgetType.Number;
        }
    }

    /** Ordered list of widgets paired with their resolved def, for the sidebar summary. */
    get dashboardMetrics(): Array<{ widget: DraftWidget; def: DataDefinition | undefined }> {
        return this.draftWidgets.map(w => ({ widget: w, def: this.defs.find(d => d.id === w.dataId) }));
    }

    getMetricDisplayValue(def: DataDefinition): string {
        if (def.value == null) { return '—'; }
        if (def.valueType === 'boolean') { return def.value ? 'On' : 'Off'; }
        if (def.valueType === 'list') {
            const arr = Array.isArray(def.value) ? def.value as string[] : [];
            if (arr.length === 0) { return '(empty)'; }
            if (arr.length === 1) { return arr[0]; }
            return `${arr[0]}, +${arr.length - 1} more`;
        }
        if (def.valueType === 'number' && def.options?.unit) { return `${def.value} ${def.options.unit}`; }
        const str = String(def.value);
        return str.length > 28 ? str.slice(0, 26) + '…' : str;
    }

    get dataDefOptions(): Array<{ label: string; value: string }> {
        return this.defs.map(d => ({
            label: `[${d.valueType}] ${d.id}${d.label ? ' — ' + d.label : ''}`,
            value: d.id,
        }));
    }

    getWidgetTypeIcon(type: DashboardWidgetType): string {
        return this.widgetTypeOptions.find(o => o.value === type)?.icon ?? 'pi-minus';
    }

    trackByWidgetId(_: number, w: DraftWidget): string { return w.id; }
}
