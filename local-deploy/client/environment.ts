// Angular production environment for the local Docker deployment.
// The reverse proxy (pm-nginx) routes /api/* to the Express server,
// so all URLs are relative to the browser's current origin.
export const environment = {
    production: true,
    apiBaseUrl: '/api',
    socketUrl: '/',
};
