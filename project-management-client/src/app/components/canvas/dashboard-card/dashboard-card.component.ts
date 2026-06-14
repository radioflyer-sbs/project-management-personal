import {
    Component, Input, Output, EventEmitter, inject, OnInit, OnChanges, SimpleChanges,
    NgZone, ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntil } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ComponentBase } from '../../component-base/component-base.component';
import { CanvasInteractionService } from '../../../services/canvas-interaction.service';
import { SelectionService } from '../../../services/selection.service';
import { DeletionService } from '../../../services/deletion.service';
import { DataDefinitionApiClient } from '../../../services/api-clients/data-definition-api.client';
import { Dashboard, DashboardWidget } from '../../../../model/shared-models/dashboard.model';
import { DataDefinition, DataValue } from '../../../../model/shared-models/data-definition.model';
import { Layout } from '../../../../model/shared-models/layout.model';
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
        CommonModule,
        ButtonModule, TooltipModule,
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

    private readonly interaction = inject(CanvasInteractionService);
    private readonly zone        = inject(NgZone);
    private readonly el          = inject(ElementRef<HTMLElement>);
    private readonly dataDefApi  = inject(DataDefinitionApiClient);
    private readonly router      = inject(Router);
    private readonly selection   = inject(SelectionService);
    private readonly deletion    = inject(DeletionService);

    localLayout!: Layout;
    private isDragging = false;

    isSelected   = false;
    dataDefs: DataDefinition[] = [];

    ngOnInit(): void {
        this.localLayout = { ...this.dashboard.layout };
        this.loadDataDefs();

        // Track selection state and sync defs when this dashboard is selected.
        this.selection.currentSelection$.pipe(takeUntil(this.ngDestroy$)).subscribe(sel => {
            if (sel?.type === 'dashboard' && (sel.item._id as any) === (this.dashboard._id as any)) {
                this.isSelected = true;
                this.dataDefs   = sel.defs;
            } else {
                this.isSelected = false;
            }
        });

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

    getDataDef(dataId: string): DataDefinition | undefined {
        return this.dataDefs.find(d => d.id === dataId);
    }

    onWidgetValueChanged(widget: DashboardWidget, value: DataValue): void {
        this.dataDefApi.setValue(this.projectId, widget.dataId, value).subscribe(updated => {
            this.dataDefs = this.dataDefs.map(d => d.id === updated.id ? updated : d);
        });
    }

    openEditor(): void {
        this.router.navigate(['/projects', this.projectId, 'dashboard', this.dashboard._id]);
    }

    openMetrics(): void {
        this.router.navigate(['/projects', this.projectId, 'metrics']);
    }

    deleteDashboard(): void {
        this.deletion.deleteDashboard(
            this.dashboard._id as string,
            this.dashboard.title,
            () => this.dashboardDeleted$.emit(this.dashboard._id as string),
        );
    }

    /** Root card mousedown — selects the dashboard without starting a drag. */
    onBodyMousedown(e: MouseEvent): void {
        if (e.button !== 0) { return; }
        e.stopPropagation();
        this.selected$.emit(this.dashboard);
        this.selection.selectDashboard(this.dashboard, this.dataDefs);
    }

    /** Header mousedown — selects and starts a drag. Stops bubbling to root. */
    onHeaderMousedown(e: MouseEvent): void {
        if (e.button !== 0) { return; }
        e.stopPropagation();
        this.selected$.emit(this.dashboard);
        this.selection.selectDashboard(this.dashboard, this.dataDefs);
        this.dragStarted$.emit(e as unknown as PointerEvent);
    }

    onResizeMousedown(handle: string, e: MouseEvent): void {
        if (!this.isSelected) { return; }
        e.stopPropagation();
        this.resizeStarted$.emit({ handle, e: e as unknown as PointerEvent });
    }
}
