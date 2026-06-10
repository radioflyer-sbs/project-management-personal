import { ObjectId } from 'mongodb';
import { DbEntity } from './db-entity.model';
import { Layout } from './layout.model';
import { CanvasViewState } from './canvas-view-state.model';
import { TaskUrgency } from './task-urgency.enum';

export interface Task extends DbEntity {
    _id: ObjectId;
    projectId: ObjectId;
    parentTaskId?: ObjectId;
    ancestorTaskIds: ObjectId[];
    title: string;
    description: string;
    urgency: TaskUrgency;
    isComplete: boolean;
    layout: Layout;
    viewState?: CanvasViewState;
    groupId?: string;
    preGroupLayout?: Layout;
}
