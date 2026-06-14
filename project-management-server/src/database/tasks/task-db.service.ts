import { injectable, inject } from 'inversify';
import { ObjectId } from 'mongodb';
import { DbService } from '../db-service';
import { MongoHelper } from '../../mongo-helper';
import { TOKENS } from '../../tokens';
import { DbCollectionNames } from '../../model/db-collection-names.constants';
import { Task } from '../../model/shared-models/task.model';
import { NewDbItem, UpsertDbItem } from '../../model/shared-models/db-operation-types.model';

@injectable()
export class TaskDbService extends DbService {

    constructor(@inject(TOKENS.MongoHelper) dbHelper: MongoHelper) {
        super(dbHelper);
    }

    async findById(id: ObjectId): Promise<Task | undefined> {
        return this.dbHelper.findDataItem<Task, {}>(
            DbCollectionNames.Tasks,
            { _id: id } as any,
            { findOne: true }
        );
    }

    async findByProject(projectId: ObjectId): Promise<Task[]> {
        return this.dbHelper.findDataItem<Task, {}>(
            DbCollectionNames.Tasks,
            { projectId, $or: [{ parentTaskId: { $exists: false } }, { parentTaskId: null }] } as any
        );
    }

    async findByParentTask(parentTaskId: ObjectId): Promise<Task[]> {
        return this.dbHelper.findDataItem<Task, {}>(
            DbCollectionNames.Tasks,
            { parentTaskId } as any
        );
    }

    async findAllByProject(projectId: ObjectId): Promise<Task[]> {
        return this.dbHelper.findDataItem<Task, {}>(
            DbCollectionNames.Tasks,
            { projectId } as any
        );
    }

    async findDescendants(taskId: ObjectId): Promise<Task[]> {
        return this.dbHelper.findDataItem<Task, {}>(
            DbCollectionNames.Tasks,
            { ancestorTaskIds: taskId } as any
        );
    }

    async create(item: NewDbItem<Task>): Promise<Task> {
        const now = new Date();
        const doc = { ...item, createdAt: now, updatedAt: now };
        return this.dbHelper.upsertDataItem<Task>(DbCollectionNames.Tasks, doc as any);
    }

    async update(item: UpsertDbItem<Task>): Promise<Task> {
        const doc = { ...item, updatedAt: new Date() };
        return this.dbHelper.upsertDataItem<Task>(DbCollectionNames.Tasks, doc as any);
    }

    async delete(id: ObjectId): Promise<void> {
        await this.dbHelper.deleteDataItems<Task>(DbCollectionNames.Tasks, { _id: id } as any);
    }

    async deleteMany(filter: Record<string, unknown>): Promise<void> {
        await this.dbHelper.deleteDataItems<Task>(DbCollectionNames.Tasks, filter as any);
    }

    async findByProjectWithProjections(projectId: ObjectId): Promise<Task[]> {
        const col = this.dbHelper.getCollection(DbCollectionNames.Tasks);
        return col.aggregate<Task>([
            { $match: { projectId, $or: [{ parentTaskId: { $exists: false } }, { parentTaskId: null }] } },
            {
                $lookup: {
                    from: DbCollectionNames.Tasks,
                    let: { taskId: '$_id' },
                    pipeline: [
                        { $match: { $expr: { $and: [
                            { $eq: ['$parentTaskId', '$$taskId'] },
                            { $eq: ['$projectToParent', true] },
                        ]}}},
                        { $sort: { projectionOrder: 1, _id: 1 } },
                        { $project: { _id: 1, title: 1, urgency: 1, isComplete: 1 } },
                    ],
                    as: 'projectedChildren',
                },
            },
        ]).toArray() as Promise<Task[]>;
    }

    async findByParentTaskWithProjections(parentTaskId: ObjectId): Promise<Task[]> {
        const col = this.dbHelper.getCollection(DbCollectionNames.Tasks);
        return col.aggregate<Task>([
            { $match: { parentTaskId } },
            {
                $lookup: {
                    from: DbCollectionNames.Tasks,
                    let: { taskId: '$_id' },
                    pipeline: [
                        { $match: { $expr: { $and: [
                            { $eq: ['$parentTaskId', '$$taskId'] },
                            { $eq: ['$projectToParent', true] },
                        ]}}},
                        { $sort: { projectionOrder: 1, _id: 1 } },
                        { $project: { _id: 1, title: 1, urgency: 1, isComplete: 1 } },
                    ],
                    as: 'projectedChildren',
                },
            },
        ]).toArray() as Promise<Task[]>;
    }

    /** Clears groupId and preGroupLayout for all tasks that belong to the given group. */
    async clearGroupMembership(groupId: ObjectId): Promise<void> {
        const col = this.dbHelper.getCollection(DbCollectionNames.Tasks);
        await col.updateMany(
            { groupId } as any,
            { $unset: { groupId: '', preGroupLayout: '' }, $set: { updatedAt: new Date() } } as any,
        );
    }

    /** Bulk-sets the `projectionOrder` field for many tasks in one round-trip. */
    async setProjectionOrders(updates: { id: ObjectId; projectionOrder: number }[]): Promise<void> {
        if (updates.length === 0) { return; }
        const col = this.dbHelper.getCollection(DbCollectionNames.Tasks);
        const now = new Date();
        await col.bulkWrite(updates.map(u => ({
            updateOne: {
                filter: { _id: u.id } as any,
                update: { $set: { projectionOrder: u.projectionOrder, updatedAt: now } },
            },
        })));
    }

    async getSubTaskCounts(taskIds: ObjectId[]): Promise<{ direct: Map<string, number>; total: Map<string, number> }> {
        if (taskIds.length === 0) { return { direct: new Map(), total: new Map() }; }
        const col = this.dbHelper.getCollection(DbCollectionNames.Tasks);
        const [directResult, totalResult] = await Promise.all([
            col.aggregate([
                { $match: { parentTaskId: { $in: taskIds } } },
                { $group: { _id: '$parentTaskId', count: { $sum: 1 } } },
            ]).toArray(),
            col.aggregate([
                { $match: { ancestorTaskIds: { $in: taskIds } } },
                { $unwind: '$ancestorTaskIds' },
                { $match: { ancestorTaskIds: { $in: taskIds } } },
                { $group: { _id: '$ancestorTaskIds', count: { $sum: 1 } } },
            ]).toArray(),
        ]);
        return {
            direct: new Map(directResult.map((r: any) => [r._id.toString(), r.count as number])),
            total:  new Map(totalResult.map((r: any) => [r._id.toString(), r.count as number])),
        };
    }
}
