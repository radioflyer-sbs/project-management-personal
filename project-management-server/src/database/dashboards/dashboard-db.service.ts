import { injectable, inject } from 'inversify';
import { ObjectId } from 'mongodb';
import { DbService } from '../db-service';
import { MongoHelper } from '../../mongo-helper';
import { TOKENS } from '../../tokens';
import { DbCollectionNames } from '../../model/db-collection-names.constants';
import { Dashboard } from '../../model/shared-models/dashboard.model';
import { NewDbItem, UpsertDbItem } from '../../model/shared-models/db-operation-types.model';

@injectable()
export class DashboardDbService extends DbService {

    constructor(@inject(TOKENS.MongoHelper) dbHelper: MongoHelper) {
        super(dbHelper);
    }

    async findById(id: ObjectId): Promise<Dashboard | undefined> {
        return this.dbHelper.findDataItem<Dashboard, {}>(
            DbCollectionNames.Dashboards,
            { _id: id } as any,
            { findOne: true }
        );
    }

    async findByProjectAndKey(projectId: ObjectId, key: string): Promise<Dashboard | undefined> {
        return this.dbHelper.findDataItem<Dashboard, {}>(
            DbCollectionNames.Dashboards,
            { projectId, key } as any,
            { findOne: true }
        );
    }

    async findByProject(projectId: ObjectId): Promise<Dashboard[]> {
        return this.dbHelper.findDataItem<Dashboard, {}>(
            DbCollectionNames.Dashboards,
            { projectId, $or: [{ parentTaskId: { $exists: false } }, { parentTaskId: null }] } as any
        );
    }

    async findByParentTask(parentTaskId: ObjectId): Promise<Dashboard[]> {
        return this.dbHelper.findDataItem<Dashboard, {}>(
            DbCollectionNames.Dashboards,
            { parentTaskId } as any
        );
    }

    async existsWithKey(projectId: ObjectId, key: string): Promise<boolean> {
        const result = await this.findByProjectAndKey(projectId, key);
        return !!result;
    }

    async create(item: NewDbItem<Dashboard>): Promise<Dashboard> {
        const now = new Date();
        const doc = { ...item, createdAt: now, updatedAt: now };
        return this.dbHelper.upsertDataItem<Dashboard>(DbCollectionNames.Dashboards, doc as any);
    }

    async update(item: UpsertDbItem<Dashboard>): Promise<Dashboard> {
        const doc = { ...item, updatedAt: new Date() };
        return this.dbHelper.upsertDataItem<Dashboard>(DbCollectionNames.Dashboards, doc as any);
    }

    async delete(id: ObjectId): Promise<void> {
        await this.dbHelper.deleteDataItems<Dashboard>(DbCollectionNames.Dashboards, { _id: id } as any);
    }
}
