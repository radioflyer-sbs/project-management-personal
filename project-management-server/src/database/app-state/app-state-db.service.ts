import { injectable, inject } from 'inversify';
import { DbService } from '../db-service';
import { MongoHelper } from '../../mongo-helper';
import { TOKENS } from '../../tokens';
import { DbCollectionNames } from '../../model/db-collection-names.constants';

export interface AppStateEntry {
    key: string;
    value: unknown;
    updatedAt: Date;
}

@injectable()
export class AppStateDbService extends DbService {

    constructor(@inject(TOKENS.MongoHelper) dbHelper: MongoHelper) {
        super(dbHelper);
    }

    async get(key: string): Promise<AppStateEntry | null> {
        const col = this.dbHelper.getCollection<AppStateEntry>(DbCollectionNames.AppState);
        return col.findOne({ key } as any) as Promise<AppStateEntry | null>;
    }

    async set(key: string, value: unknown): Promise<AppStateEntry> {
        const col = this.dbHelper.getCollection<AppStateEntry>(DbCollectionNames.AppState);
        const entry: AppStateEntry = { key, value, updatedAt: new Date() };
        await col.updateOne(
            { key } as any,
            { $set: entry } as any,
            { upsert: true },
        );
        return entry;
    }
}
