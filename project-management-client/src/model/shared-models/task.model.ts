import { ObjectId } from 'mongodb';
import { DbEntity } from './db-entity.model';
import { Layout } from './layout.model';
import { CanvasViewState } from './canvas-view-state.model';
import { TaskUrgency } from './task-urgency.enum';

export interface ProjectedChild {
    _id: ObjectId;
    title: string;
    urgency: TaskUrgency;
    isComplete: boolean;
}

export interface Task extends DbEntity {
    _id: ObjectId;
    projectId: ObjectId;
    parentTaskId?: ObjectId;
    ancestorTaskIds: ObjectId[];
    title: string;
    description: string;
    urgency: TaskUrgency;
    isComplete: boolean;
    /** Optional due date/time. Drives the countdown shown on the task card. */
    dueDate?: Date;
    projectToParent?: boolean;
    layout: Layout;
    viewState?: CanvasViewState;
    groupId?: string;
    preGroupLayout?: Layout;
    /**
     * Reading-order rank of this task among its parent's direct children, derived
     * from the parent canvas layout (computed server-side on layout changes). Lower
     * sorts first. Drives the order of the parent's projected-children list.
     */
    projectionOrder?: number;
    projectedChildren?: ProjectedChild[];
}
