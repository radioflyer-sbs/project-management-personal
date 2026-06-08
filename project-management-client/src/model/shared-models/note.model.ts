import { ObjectId } from 'mongodb';
import { DbEntity } from './db-entity.model';
import { Layout } from './layout.model';

export interface Note extends DbEntity {
    _id: ObjectId;
    projectId: ObjectId;
    parentTaskId?: ObjectId;
    ancestorTaskIds: ObjectId[];
    title: string;
    details: string;
    backgroundColor: string;
    layout: Layout;
}
