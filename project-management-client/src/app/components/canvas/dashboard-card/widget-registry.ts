import { Type } from '@angular/core';
import { DashboardWidgetType } from '../../../../model/shared-models/dashboard.model';
import { WidgetNumberComponent } from './widgets/widget-number.component';
import { WidgetProgressComponent } from './widgets/widget-progress.component';
import { WidgetStatusComponent } from './widgets/widget-status.component';
import { WidgetTextComponent } from './widgets/widget-text.component';
import { WidgetListComponent } from './widgets/widget-list.component';
import { WidgetToggleComponent } from './widgets/widget-toggle.component';
import { WidgetGaugeComponent } from './widgets/widget-gauge.component';

export const WIDGET_REGISTRY: Record<DashboardWidgetType, Type<any>> = {
    [DashboardWidgetType.Number]:   WidgetNumberComponent,
    [DashboardWidgetType.Progress]: WidgetProgressComponent,
    [DashboardWidgetType.Status]:   WidgetStatusComponent,
    [DashboardWidgetType.Text]:     WidgetTextComponent,
    [DashboardWidgetType.List]:     WidgetListComponent,
    [DashboardWidgetType.Toggle]:   WidgetToggleComponent,
    [DashboardWidgetType.Gauge]:    WidgetGaugeComponent,
};

export const WIDGET_TYPE_OPTIONS: Array<{ label: string; value: DashboardWidgetType; icon: string }> = [
    { label: 'Number',   value: DashboardWidgetType.Number,   icon: 'pi-hashtag' },
    { label: 'Progress', value: DashboardWidgetType.Progress, icon: 'pi-chart-bar' },
    { label: 'Status',   value: DashboardWidgetType.Status,   icon: 'pi-tag' },
    { label: 'Text',     value: DashboardWidgetType.Text,     icon: 'pi-align-left' },
    { label: 'List',     value: DashboardWidgetType.List,     icon: 'pi-list' },
    { label: 'Toggle',   value: DashboardWidgetType.Toggle,   icon: 'pi-toggle-on' },
    { label: 'Gauge',    value: DashboardWidgetType.Gauge,    icon: 'pi-chart-pie' },
];
