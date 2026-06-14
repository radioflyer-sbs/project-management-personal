import 'reflect-metadata';                        // MUST be the very first import
import { buildContainer } from './container';
import { getAppConfig } from './config';
import { initializeExpressApp } from './setup-express';
import { systemInitialization } from './system-setup';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

async function run() {
    const container = await buildContainer();
    const config = await getAppConfig();

    // Create server and io before setting up routes so the emit middleware
    // can be registered at the top of the Express stack (before all routes).
    const server = http.createServer();
    const io = new SocketIOServer(server, {
        cors: { origin: config.corsAllowed },
    });

    const app = await initializeExpressApp(container, io);
    server.on('request', app);

    await systemInitialization(container);

    server.listen(config.serverConfig.port, () => {
        console.log(`Server running on port ${config.serverConfig.port}`);
    });
}

run().catch(err => {
    console.error('Fatal startup error:', err);
    process.exit(1);
});
