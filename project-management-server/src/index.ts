import 'reflect-metadata';                        // MUST be the very first import
import { buildContainer } from './container';
import { getAppConfig } from './config';
import { initializeExpressApp } from './setup-express';
import { systemInitialization } from './system-setup';
import http from 'http';

async function run() {
    const container = await buildContainer();
    const config = await getAppConfig();

    const app = await initializeExpressApp(container);
    const server = http.createServer(app);

    await systemInitialization(container);

    server.listen(config.serverConfig.port, () => {
        console.log(`Server running on port ${config.serverConfig.port}`);
    });
}

run().catch(err => {
    console.error('Fatal startup error:', err);
    process.exit(1);
});
