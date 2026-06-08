import { Container } from 'inversify';
import { TOKENS } from './tokens';
import { MongoHelper } from './mongo-helper';
import { DbCollectionNames } from './model/db-collection-names.constants';

export async function systemInitialization(container: Container): Promise<void> {
    const db = await container.getAsync<MongoHelper>(TOKENS.MongoHelper);
    await createIndexes(db);
}

async function createIndexes(db: MongoHelper): Promise<void> {
    const tasks = db.getCollection(DbCollectionNames.Tasks);
    const notes = db.getCollection(DbCollectionNames.Notes);

    await Promise.all([
        tasks.createIndex({ projectId: 1, parentTaskId: 1 }),
        tasks.createIndex({ ancestorTaskIds: 1 }),
        tasks.createIndex({ projectId: 1 }),
        notes.createIndex({ projectId: 1, parentTaskId: 1 }),
        notes.createIndex({ ancestorTaskIds: 1 }),
        notes.createIndex({ projectId: 1 }),
    ]);

    console.log('MongoDB indexes ensured.');
}
