import { ObjectId } from 'mongodb';
import { DbEntity } from './db-entity.model';
import { Layout } from './layout.model';
import { CanvasViewState } from './canvas-view-state.model';
import { TaskUrgency } from './task-urgency.enum';

export interface ProjectedChild {
    _id: ObjectId;
    title: string;
    urgency: TaskUrgency;
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
    projectToParent?: boolean;
    layout: Layout;
    viewState?: CanvasViewState;
    groupId?: string;
    preGroupLayout?: Layout;
    projectedChildren?: ProjectedChild[];
}
