import { Request, Response, NextFunction } from 'express';
import { verifyToken } from './jwt';

/** Validates the JWT in the Authorization header and attaches the decoded user to req.user. */
export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    const token = req.headers['authorization'] as string;

    if (!token) {
        res.status(401).json({ message: 'Access denied. No token provided.' });
        return;
    }

    const decoded = await verifyToken(token);

    if (!decoded) {
        res.status(401).json({ message: 'Invalid token.' });
        return;
    }

    (req as Request & { user: unknown }).user = decoded;
    next();
}
