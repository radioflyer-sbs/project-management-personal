import { ObjectId } from 'mongodb';
import { DbEntity } from './db-entity.model';
import { CanvasViewState } from './canvas-view-state.model';

export interface Project extends DbEntity {
    _id: ObjectId;
    name: string;
    description: string;
    viewState?: CanvasViewState;
}
