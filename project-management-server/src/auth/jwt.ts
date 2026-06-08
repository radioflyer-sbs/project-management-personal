import jwt from 'jsonwebtoken';
import { getAppConfig } from '../config';

export interface TokenPayload {
    userId: string;
    email: string;
}

/** Signs a JWT with the configured secret. */
export async function signToken(payload: TokenPayload): Promise<string> {
    const config = await getAppConfig();
    return jwt.sign(payload, config.serverConfig.jwtSecret, { expiresIn: '7d' });
}

/** Verifies a JWT and returns the decoded payload, or undefined if invalid. */
export async function verifyToken(token: string): Promise<TokenPayload | undefined> {
    try {
        const config = await getAppConfig();
        return jwt.verify(token, config.serverConfig.jwtSecret) as TokenPayload;
    } catch {
        return undefined;
    }
}
