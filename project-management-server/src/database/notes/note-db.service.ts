import { injectable, inject } from 'inversify';
import { ObjectId } from 'mongodb';
import { DbService } from '../db-service';
import { MongoHelper } from '../../mongo-helper';
import { TOKENS } from '../../tokens';
import { DbCollectionNames } from '../../model/db-collection-names.constants';
import { Note } from '../../model/shared-models/note.model';
import { NewDbItem, UpsertDbItem } from '../../model/shared-models/db-operation-types.model';

@injectable()
export class NoteDbService extends DbService {

    constructor(@inject(TOKENS.MongoHelper) dbHelper: MongoHelper) {
        super(dbHelper);
    }

    async findById(id: ObjectId): Promise<Note | undefined> {
        return this.dbHelper.findDataItem<Note, {}>(
            DbCollectionNames.Notes,
            { _id: id } as any,
            { findOne: true }
        );
    }

    async findByProject(projectId: ObjectId): Promise<Note[]> {
        return this.dbHelper.findDataItem<Note, {}>(
            DbCollectionNames.Notes,
            { projectId, $or: [{ parentTaskId: { $exists: false } }, { parentTaskId: null }] } as any
        );
    }

    async findByParentTask(parentTaskId: ObjectId): Promise<Note[]> {
        return this.dbHelper.findDataItem<Note, {}>(
            DbCollectionNames.Notes,
            { parentTaskId } as any
        );
    }

    async findDescendants(taskId: ObjectId): Promise<Note[]> {
        return this.dbHelper.findDataItem<Note, {}>(
            DbCollectionNames.Notes,
            { ancestorTaskIds: taskId } as any
        );
    }

    async create(item: NewDbItem<Note>): Promise<Note> {
        const now = new Date();
        const doc = { ...item, createdAt: now, updatedAt: now };
        return this.dbHelper.upsertDataItem<Note>(DbCollectionNames.Notes, doc as any);
    }

    async update(item: UpsertDbItem<Note>): Promise<Note> {
        const doc = { ...item, updatedAt: new Date() };
        return this.dbHelper.upsertDataItem<Note>(DbCollectionNames.Notes, doc as any);
    }

    async delete(id: ObjectId): Promise<void> {
        await this.dbHelper.deleteDataItems<Note>(DbCollectionNames.Notes, { _id: id } as any);
    }

    async deleteMany(filter: Record<string, unknown>): Promise<void> {
        await this.dbHelper.deleteDataItems<Note>(DbCollectionNames.Notes, filter as any);
    }

    async getDirectNoteCountsForTasks(taskIds: ObjectId[]): Promise<Map<string, number>> {
        if (taskIds.length === 0) { return new Map(); }
        const col = this.dbHelper.getCollection(DbCollectionNames.Notes);
        const result = await col.aggregate([
            { $match: { parentTaskId: { $in: taskIds } } },
            { $group: { _id: '$parentTaskId', count: { $sum: 1 } } },
        ]).toArray();
        return new Map(result.map((r: any) => [r._id.toString(), r.count as number]));
    }
}
