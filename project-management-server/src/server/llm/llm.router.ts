import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';
import { LlmModelDbService } from '../../database/llm/llm-model-db.service';
import { clearConfigCache } from '../../config';

const OllamaSettingsSchema = z.object({
    baseUrl:   z.string().min(1),
    timeoutMs: z.number().int().positive(),
});

const LlmSettingsSchema = z.object({
    ollama: OllamaSettingsSchema,
});

const OllamaParametersSchema = z.object({
    temperature:   z.number(),
    topK:          z.number().int(),
    topP:          z.number(),
    minP:          z.number(),
    repeatPenalty: z.number(),
    repeatLastN:   z.number().int(),
    numCtx:        z.number().int().positive(),
    numPredict:    z.number().int(),
    seed:          z.number().int(),
    stop:          z.array(z.string()),
    mirostat:      z.union([z.literal(0), z.literal(1), z.literal(2)]),
    mirostatTau:   z.number(),
    mirostatEta:   z.number(),
});

const LongTextFormatSchema = z.object({
    enabled:         z.boolean(),
    systemPrefix:    z.string(),
    systemSuffix:    z.string(),
    humanPrefix:     z.string(),
    humanSuffix:     z.string(),
    assistantPrefix: z.string(),
    assistantSuffix: z.string(),
});

const LlmModelSchema = z.object({
    provider:       z.literal('ollama'),
    modelName:      z.string().min(1),
    displayName:    z.string().min(1),
    parameters:     OllamaParametersSchema,
    longTextFormat: LongTextFormatSchema,
});

function getConfigFilePath(): string {
    return path.resolve(process.cwd(), 'app-config.json');
}

function readRawConfig(): Record<string, unknown> {
    const raw = fs.readFileSync(getConfigFilePath(), 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
}

function writeRawConfig(config: Record<string, unknown>): void {
    fs.writeFileSync(getConfigFilePath(), JSON.stringify(config, null, 2), 'utf-8');
}

function fetchOllamaJson(url: string, timeoutMs: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https:') ? https : http;
        const req = client.get(url, (res) => {
            if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
                res.resume();
                reject(new Error(`Ollama returned HTTP ${res.statusCode}`));
                return;
            }
            let body = '';
            res.setEncoding('utf-8');
            res.on('data', (chunk: string) => { body += chunk; });
            res.on('end', () => {
                try { resolve(JSON.parse(body)); }
                catch { reject(new Error('Invalid JSON response from Ollama')); }
            });
        });
        req.setTimeout(timeoutMs, () => {
            req.destroy(new Error('Request timed out'));
        });
        req.on('error', reject);
    });
}

export function createLlmRouter(llmModelDb: LlmModelDbService): Router {
    const router = Router();

    router.get('/settings', (_req: Request, res: Response) => {
        try {
            const config = readRawConfig();
            const llm = (config['llm'] as Record<string, unknown> | undefined) ?? {};
            res.json(llm);
        } catch (err) {
            res.status(500).json({ message: 'Failed to read LLM settings' });
        }
    });

    router.put('/settings', (req: Request, res: Response) => {
        const parse = LlmSettingsSchema.safeParse(req.body);
        if (!parse.success) { res.status(400).json({ message: 'Invalid body', errors: parse.error.issues }); return; }
        try {
            const config = readRawConfig();
            config['llm'] = parse.data;
            writeRawConfig(config);
            clearConfigCache();
            res.json(parse.data);
        } catch (err) {
            res.status(500).json({ message: 'Failed to write LLM settings' });
        }
    });

    router.get('/ollama/models', async (_req: Request, res: Response) => {
        try {
            const config = readRawConfig();
            const llm = config['llm'] as { ollama?: { baseUrl?: string; timeoutMs?: number } } | undefined;
            const baseUrl   = llm?.ollama?.baseUrl   ?? 'http://localhost:11434';
            const timeoutMs = llm?.ollama?.timeoutMs ?? 30000;
            const data = await fetchOllamaJson(`${baseUrl}/api/tags`, timeoutMs);
            res.json(data);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            res.status(503).json({ message: `Ollama unreachable: ${message}` });
        }
    });

    router.get('/models', async (_req: Request, res: Response) => {
        try {
            const models = await llmModelDb.findAll();
            res.json(models);
        } catch (err) {
            res.status(500).json({ message: 'Failed to load LLM models' });
        }
    });

    router.get('/models/:id', async (req: Request, res: Response) => {
        try {
            const model = await llmModelDb.findById(new ObjectId(String(req.params.id)));
            if (!model) { res.status(404).json({ message: 'LLM model not found' }); return; }
            res.json(model);
        } catch (err) {
            res.status(500).json({ message: 'Failed to load LLM model' });
        }
    });

    router.post('/models', async (req: Request, res: Response) => {
        const parse = LlmModelSchema.safeParse(req.body);
        if (!parse.success) { res.status(400).json({ message: 'Invalid body', errors: parse.error.issues }); return; }
        try {
            const model = await llmModelDb.create(parse.data as any);
            res.status(201).json(model);
        } catch (err) {
            res.status(500).json({ message: 'Failed to create LLM model' });
        }
    });

    router.put('/models/:id', async (req: Request, res: Response) => {
        const parse = LlmModelSchema.safeParse(req.body);
        if (!parse.success) { res.status(400).json({ message: 'Invalid body', errors: parse.error.issues }); return; }
        try {
            const existing = await llmModelDb.findById(new ObjectId(String(req.params.id)));
            if (!existing) { res.status(404).json({ message: 'LLM model not found' }); return; }
            const updated = await llmModelDb.update({ ...existing, ...parse.data, _id: existing._id });
            res.json(updated);
        } catch (err) {
            res.status(500).json({ message: 'Failed to update LLM model' });
        }
    });

    router.delete('/models/:id', async (req: Request, res: Response) => {
        try {
            await llmModelDb.delete(new ObjectId(String(req.params.id)));
            res.status(204).send();
        } catch (err) {
            res.status(500).json({ message: 'Failed to delete LLM model' });
        }
    });

    return router;
}
