import { ObjectId } from 'mongodb';

/** Payload type for creating a new database item — omits the _id field. */
export type NewDbItem<T extends { _id: ObjectId }> = Omit<T, '_id'>;

/** Payload type for upserting a database item — _id is optional (absent = insert, present = update). */
export type UpsertDbItem<T extends { _id: ObjectId }> = Omit<T, '_id'> & { _id?: ObjectId };
