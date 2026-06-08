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
}
