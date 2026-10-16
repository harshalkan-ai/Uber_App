import { Response, NextFunction } from 'express';
import { verifyToken } from '@clerk/backend';
import { AuthenticatedRequest } from '../types';
import { AppError } from './error.middleware';
import dotenv from 'dotenv';

dotenv.config();

const clerkSecretKey = process.env.CLERK_SECRET_KEY;

if (!clerkSecretKey) {
    throw new Error('CLERK_SECRET_KEY is missing in backend/.env');
}

export const requireAuth = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next(new AppError('Authentication required: Missing or malformed token', 401));
        }

        const token = authHeader.split(' ')[1];

        // Verify token using Clerk's direct JWT verification
        const verifiedToken = await verifyToken(token, {
            secretKey: clerkSecretKey,
        });

        if (!verifiedToken || !verifiedToken.sub) {
            return next(new AppError('Unauthorized: Invalid or expired token', 401));
        }

        // Attach the verified Clerk user ID (sub) to the request object
        req.userId = verifiedToken.sub;
        next();
    } catch (error: any) {
        next(new AppError(`Authentication failed: ${error.message || 'Invalid session'}`, 401));
    }
};