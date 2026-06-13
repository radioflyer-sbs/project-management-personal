import { ObjectId } from 'mongodb';
import { DbEntity } from './db-entity.model';
import { Layout } from './layout.model';

export enum DashboardWidgetType {
    Number   = 'number',
    Progress = 'progress',
    Status   = 'status',
    Text     = 'text',
    List     = 'list',
    Toggle   = 'toggle',
    Gauge    = 'gauge',
}

export interface DashboardWidgetOptions {
    format?: string;
    colorThresholds?: Array<{ value: number; color: string }>;
    suffix?: string;
    prefix?: string;
}

export interface DashboardWidget {
    /** Unique within the dashboard. Immutable after creation. */
    id: string;
    /** References a DataDefinition.id in the same project. */
    dataId: string;
    type: DashboardWidgetType;
    label?: string;
    /** PrimeIcons name (e.g. 'pi-check-circle'). */
    icon?: string;
    editable: boolean;
    options?: DashboardWidgetOptions;
}

export interface DashboardConfig {
    widgets: DashboardWidget[];
}

export interface Dashboard extends DbEntity {
    _id: ObjectId;
    projectId: ObjectId;
    parentTaskId?: ObjectId;
    ancestorTaskIds: ObjectId[];
    layout: Layout;
    title: string;
    /** Unique per project — the stable address for API/MCP. */
    key: string;
    config: DashboardConfig;
}
