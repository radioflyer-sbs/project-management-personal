import { Container } from 'inversify';
import { TOKENS } from './tokens';
import { getAppConfig } from './config';
import { MongoHelper } from './mongo-helper';

/** Builds and returns the fully-wired Inversify container.
 *  This is the single composition root — every service is bound here. */
export async function buildContainer(): Promise<Container> {
    const config = await getAppConfig();
    const container = new Container({ defaultScope: 'Singleton' });

    // Config
    container.bind(TOKENS.AppConfig).toConstantValue(config);

    // MongoDB — connect once at startup
    container.bind<MongoHelper>(TOKENS.MongoHelper).toDynamicValue(async () => {
        const helper = new MongoHelper(config.mongo.connectionString, config.mongo.databaseName);
        await helper.connect();
        return helper;
    }).inSingletonScope();

    // TODO-Immediate: Bind your DB and app services here following the pattern above.

    return container;
}
