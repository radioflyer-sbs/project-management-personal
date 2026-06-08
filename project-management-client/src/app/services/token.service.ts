import { Injectable } from '@angular/core';

/** Manages the JWT auth token in localStorage. */
@Injectable({ providedIn: 'root' })
export class TokenService {

    constructor() { }

    private readonly tokenKey = 'auth_token';

    /** Returns the stored JWT, or undefined if not present. */
    getToken(): string | undefined {
        return localStorage.getItem(this.tokenKey) ?? undefined;
    }

    /** Stores the JWT. */
    setToken(token: string): void {
        localStorage.setItem(this.tokenKey, token);
    }

    /** Removes the stored JWT. */
    clearToken(): void {
        localStorage.removeItem(this.tokenKey);
    }

    /** Decodes the JWT payload without verifying the signature. */
    parseToken(): Record<string, unknown> | undefined {
        const token = this.getToken();
        if (!token) {
            return undefined;
        }

        try {
            return JSON.parse(atob(token.split('.')[1]));
        } catch {
            return undefined;
        }
    }
}
