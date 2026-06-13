import { injectable, inject } from 'inversify';
import { ObjectId } from 'mongodb';
import { DbService } from '../db-service';
import { MongoHelper } from '../../mongo-helper';
import { TOKENS } from '../../tokens';
import { DbCollectionNames } from '../../model/db-collection-names.constants';
import { DataDefinition } from '../../model/shared-models/data-definition.model';
import { NewDbItem, UpsertDbItem } from '../../model/shared-models/db-operation-types.model';

@injectable()
export class DataDefinitionDbService extends DbService {

    constructor(@inject(TOKENS.MongoHelper) dbHelper: MongoHelper) {
        super(dbHelper);
    }

    async findByProject(projectId: ObjectId): Promise<DataDefinition[]> {
        return this.dbHelper.findDataItem<DataDefinition, {}>(
            DbCollectionNames.DataDefinitions,
            { projectId } as any
        );
    }

    async findByProjectAndId(projectId: ObjectId, id: string): Promise<DataDefinition | undefined> {
        return this.dbHelper.findDataItem<DataDefinition, {}>(
            DbCollectionNames.DataDefinitions,
            { projectId, id } as any,
            { findOne: true }
        );
    }

    async findByMongoId(mongoId: ObjectId): Promise<DataDefinition | undefined> {
        return this.dbHelper.findDataItem<DataDefinition, {}>(
            DbCollectionNames.DataDefinitions,
            { _id: mongoId } as any,
            { findOne: true }
        );
    }

    async existsWithId(projectId: ObjectId, id: string): Promise<boolean> {
        const result = await this.findByProjectAndId(projectId, id);
        return !!result;
    }

    async create(item: NewDbItem<DataDefinition>): Promise<DataDefinition> {
        const now = new Date();
        const doc = { ...item, createdAt: now, updatedAt: now };
        return this.dbHelper.upsertDataItem<DataDefinition>(DbCollectionNames.DataDefinitions, doc as any);
    }

    async update(item: UpsertDbItem<DataDefinition>): Promise<DataDefinition> {
        const doc = { ...item, updatedAt: new Date() };
        return this.dbHelper.upsertDataItem<DataDefinition>(DbCollectionNames.DataDefinitions, doc as any);
    }

    async setValue(projectId: ObjectId, id: string, value: DataDefinition['value']): Promise<DataDefinition | undefined> {
        const existing = await this.findByProjectAndId(projectId, id);
        if (!existing) { return undefined; }
        return this.update({ ...existing, value });
    }

    async delete(mongoId: ObjectId): Promise<void> {
        await this.dbHelper.deleteDataItems<DataDefinition>(DbCollectionNames.DataDefinitions, { _id: mongoId } as any);
    }
}
