import { ObjectId } from 'mongodb';
import { DbEntity } from './db-entity.model';
import { Layout } from './layout.model';

export type GroupLayoutDirection = 'vertical' | 'horizontal';

export interface Group extends DbEntity {
    _id: ObjectId;
    projectId: ObjectId;
    parentTaskId?: ObjectId;
    title: string;
    layout: Layout;
    itemIds: string[];
    layoutDirection?: GroupLayoutDirection;
    layoutWrap?: boolean;
}
