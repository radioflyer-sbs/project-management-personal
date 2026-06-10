import { injectable, inject } from 'inversify';
import { ObjectId } from 'mongodb';
import { DbService } from '../db-service';
import { MongoHelper } from '../../mongo-helper';
import { TOKENS } from '../../tokens';
import { DbCollectionNames } from '../../model/db-collection-names.constants';
import { Group } from '../../model/shared-models/group.model';
import { NewDbItem, UpsertDbItem } from '../../model/shared-models/db-operation-types.model';

@injectable()
export class GroupDbService extends DbService {

    constructor(@inject(TOKENS.MongoHelper) dbHelper: MongoHelper) {
        super(dbHelper);
    }

    async findById(id: ObjectId): Promise<Group | undefined> {
        return this.dbHelper.findDataItem<Group, {}>(
            DbCollectionNames.Groups,
            { _id: id } as any,
            { findOne: true }
        );
    }

    async findByProject(projectId: ObjectId): Promise<Group[]> {
        return this.dbHelper.findDataItem<Group, {}>(
            DbCollectionNames.Groups,
            { projectId, $or: [{ parentTaskId: { $exists: false } }, { parentTaskId: null }] } as any
        );
    }

    async findByParentTask(parentTaskId: ObjectId): Promise<Group[]> {
        return this.dbHelper.findDataItem<Group, {}>(
            DbCollectionNames.Groups,
            { parentTaskId } as any
        );
    }

    async create(item: NewDbItem<Group>): Promise<Group> {
        const now = new Date();
        const doc = { ...item, createdAt: now, updatedAt: now };
        return this.dbHelper.upsertDataItem<Group>(DbCollectionNames.Groups, doc as any);
    }

    async update(item: UpsertDbItem<Group>): Promise<Group> {
        const doc = { ...item, updatedAt: new Date() };
        return this.dbHelper.upsertDataItem<Group>(DbCollectionNames.Groups, doc as any);
    }

    async delete(id: ObjectId): Promise<void> {
        await this.dbHelper.deleteDataItems<Group>(DbCollectionNames.Groups, { _id: id } as any);
    }
}
