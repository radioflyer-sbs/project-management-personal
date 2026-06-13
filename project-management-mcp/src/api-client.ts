/** Thin HTTP client for the Project Management REST API. */

const BASE_URL = process.env['PM_API_URL'] ?? 'http://localhost:1073/api';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${BASE_URL}${path}`;
    const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (response.status === 204) { return undefined as T; }

    const text = await response.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = text; }

    if (!response.ok) {
        const message = (data as any)?.message ?? `HTTP ${response.status}`;
        const err = new Error(message) as any;
        err.status = response.status;
        err.body   = data;
        throw err;
    }

    return data as T;
}

export const api = {
    get:    <T>(path: string)                    => request<T>('GET',    path),
    post:   <T>(path: string, body: unknown)     => request<T>('POST',   path, body),
    put:    <T>(path: string, body: unknown)     => request<T>('PUT',    path, body),
    delete: <T>(path: string)                    => request<T>('DELETE', path),
};
