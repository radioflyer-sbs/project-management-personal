import { InjectionToken } from '@angular/core';
import { DashboardWidget } from '../../../../../model/shared-models/dashboard.model';
import { DataDefinition } from '../../../../../model/shared-models/data-definition.model';

export interface WidgetContext {
    widget: DashboardWidget;
    dataDef: DataDefinition | undefined;
}
