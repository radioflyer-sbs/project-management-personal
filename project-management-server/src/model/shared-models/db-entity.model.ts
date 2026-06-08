import { ObjectId } from 'mongodb';

export interface DbEntity {
    _id: ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
