import { injectable, inject } from 'inversify';
import { ObjectId } from 'mongodb';
import { DbService } from '../db-service';
import { MongoHelper } from '../../mongo-helper';
import { TOKENS } from '../../tokens';
import { DbCollectionNames } from '../../model/db-collection-names.constants';
import { LlmModel } from '../../model/shared-models/llm-model.model';
import { NewDbItem, UpsertDbItem } from '../../model/shared-models/db-operation-types.model';

@injectable()
export class LlmModelDbService extends DbService {

    constructor(@inject(TOKENS.MongoHelper) dbHelper: MongoHelper) {
        super(dbHelper);
    }

    async findAll(): Promise<LlmModel[]> {
        return this.dbHelper.findDataItem<LlmModel, {}>(DbCollectionNames.LlmModels, {});
    }

    async findById(id: ObjectId): Promise<LlmModel | undefined> {
        return this.dbHelper.findDataItem<LlmModel, {}>(
            DbCollectionNames.LlmModels,
            { _id: id } as any,
            { findOne: true },
        );
    }

    async create(item: NewDbItem<LlmModel>): Promise<LlmModel> {
        const now = new Date();
        const doc = { ...item, createdAt: now, updatedAt: now };
        return this.dbHelper.upsertDataItem<LlmModel>(DbCollectionNames.LlmModels, doc as any);
    }

    async update(item: UpsertDbItem<LlmModel>): Promise<LlmModel> {
        const doc = { ...item, updatedAt: new Date() };
        return this.dbHelper.upsertDataItem<LlmModel>(DbCollectionNames.LlmModels, doc as any);
    }

    async delete(id: ObjectId): Promise<void> {
        await this.dbHelper.deleteDataItems<LlmModel>(DbCollectionNames.LlmModels, { _id: id } as any);
    }
}
