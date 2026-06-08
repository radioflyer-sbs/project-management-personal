import { injectable, inject } from 'inversify';
import { ObjectId } from 'mongodb';
import { DbService } from '../db-service';
import { MongoHelper } from '../../mongo-helper';
import { TOKENS } from '../../tokens';
import { DbCollectionNames } from '../../model/db-collection-names.constants';
import { Project } from '../../model/shared-models/project.model';
import { NewDbItem, UpsertDbItem } from '../../model/shared-models/db-operation-types.model';

@injectable()
export class ProjectDbService extends DbService {

    constructor(@inject(TOKENS.MongoHelper) dbHelper: MongoHelper) {
        super(dbHelper);
    }

    async findAll(): Promise<Project[]> {
        return this.dbHelper.findDataItem<Project, {}>(DbCollectionNames.Projects, {});
    }

    async findById(id: ObjectId): Promise<Project | undefined> {
        return this.dbHelper.findDataItem<Project, {}>(
            DbCollectionNames.Projects,
            { _id: id } as any,
            { findOne: true }
        );
    }

    async create(item: NewDbItem<Project>): Promise<Project> {
        const now = new Date();
        const doc = { ...item, createdAt: now, updatedAt: now };
        return this.dbHelper.upsertDataItem<Project>(DbCollectionNames.Projects, doc as any);
    }

    async update(item: UpsertDbItem<Project>): Promise<Project> {
        const doc = { ...item, updatedAt: new Date() };
        return this.dbHelper.upsertDataItem<Project>(DbCollectionNames.Projects, doc as any);
    }

    async delete(id: ObjectId): Promise<void> {
        await this.dbHelper.deleteDataItems<Project>(DbCollectionNames.Projects, { _id: id } as any);
    }
}
