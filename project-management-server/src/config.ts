import * as fs from 'fs';
import * as path from 'path';

/** Shape of app-config.json. Extend as the project grows. */
export interface IAppConfig {
    serverConfig: {
        port: number;
        jwtSecret: string;
    };
    mongo: {
        connectionString: string;
        databaseName: string;
    };
    corsAllowed: string[];
    llm?: {
        ollama?: {
            baseUrl:   string;
            timeoutMs: number;
        };
    };
}

/** Maps config leaf paths to overriding environment variable names. */
const CONFIG_ENV_MAP: Record<string, string> = {
    'serverConfig.port':        'SERVER_PORT',
    'serverConfig.jwtSecret':   'JWT_SECRET',
    'mongo.connectionString':   'MONGO_CONNECTION_STRING',
    'mongo.databaseName':       'MONGO_DATABASE_NAME',
};

let cachedConfig: IAppConfig | undefined;

export function clearConfigCache(): void {
    cachedConfig = undefined;
}

/** Returns the app config, reading from disk once and caching thereafter.
 *  Each leaf value can be overridden by the corresponding environment variable. */
export async function getAppConfig(): Promise<IAppConfig> {
    if (cachedConfig) {
        return cachedConfig;
    }

    const configPath = path.resolve(process.cwd(), 'app-config.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw) as IAppConfig;

    // Apply env-var overrides.
    for (const [dotPath, envKey] of Object.entries(CONFIG_ENV_MAP)) {
        const envValue = process.env[envKey];
        if (!envValue) {
            continue;
        }

        setNestedValue(config as unknown as Record<string, unknown>, dotPath, envValue);
    }

    cachedConfig = config;
    return config;
}

function setNestedValue(obj: Record<string, unknown>, dotPath: string, value: string): void {
    const parts = dotPath.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
        current = current[parts[i]] as Record<string, unknown>;
    }

    const lastKey = parts[parts.length - 1];
    const existing = current[lastKey];

    // Preserve numeric types.
    current[lastKey] = typeof existing === 'number' ? Number(value) : value;
}
