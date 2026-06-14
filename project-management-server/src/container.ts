import { Container } from 'inversify';
import { TOKENS } from './tokens';
import { getAppConfig } from './config';
import { MongoHelper } from './mongo-helper';
import { ProjectDbService } from './database/projects/project-db.service';
import { TaskDbService } from './database/tasks/task-db.service';
import { NoteDbService } from './database/notes/note-db.service';
import { CascadeDeleteService } from './database/cascade-delete.service';
import { LlmModelDbService } from './database/llm/llm-model-db.service';
import { GroupDbService } from './database/groups/group-db.service';
import { ProjectionOrderService } from './database/projection-order.service';
import { DataDefinitionDbService } from './database/data-definitions/data-definition-db.service';
import { DashboardDbService } from './database/dashboards/dashboard-db.service';
import { AppStateDbService } from './database/app-state/app-state-db.service';

export async function buildContainer(): Promise<Container> {
    const config = await getAppConfig();
    const container = new Container({ defaultScope: 'Singleton' });

    container.bind(TOKENS.AppConfig).toConstantValue(config);

    container.bind<MongoHelper>(TOKENS.MongoHelper).toDynamicValue(async () => {
        const helper = new MongoHelper(config.mongo.connectionString, config.mongo.databaseName);
        await helper.connect();
        return helper;
    }).inSingletonScope();

    container.bind<ProjectDbService>(TOKENS.ProjectDbService).to(ProjectDbService).inSingletonScope();
    container.bind<TaskDbService>(TOKENS.TaskDbService).to(TaskDbService).inSingletonScope();
    container.bind<NoteDbService>(TOKENS.NoteDbService).to(NoteDbService).inSingletonScope();
    container.bind<CascadeDeleteService>(TOKENS.CascadeDeleteService).to(CascadeDeleteService).inSingletonScope();
    container.bind<LlmModelDbService>(TOKENS.LlmModelDbService).to(LlmModelDbService).inSingletonScope();
    container.bind<GroupDbService>(TOKENS.GroupDbService).to(GroupDbService).inSingletonScope();
    container.bind<ProjectionOrderService>(TOKENS.ProjectionOrderService).to(ProjectionOrderService).inSingletonScope();
    container.bind<DataDefinitionDbService>(TOKENS.DataDefinitionDbService).to(DataDefinitionDbService).inSingletonScope();
    container.bind<DashboardDbService>(TOKENS.DashboardDbService).to(DashboardDbService).inSingletonScope();
    container.bind<AppStateDbService>(TOKENS.AppStateDbService).to(AppStateDbService).inSingletonScope();

    return container;
}
