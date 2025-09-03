import { config } from '@/core/config';
import { AuthenticationError, AuthorizationError } from '@/core/errors/AppError';
import { AppLogger } from '@/core/logging/logger';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export interface JWTPayload {
    id: string;
    email: string;
    role: string;
    iat: number;
    exp: number;
}

export interface RequestWithUser extends Request {
    user: JWTPayload;
    userId: string;
    userRole: string;
}

/**
 * Middleware to authenticate JWT token
 */
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            throw new AuthenticationError('Authentication header is required');
        }

        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

        if (!token) {
            throw new AuthenticationError('Authentication token is required');
        }

        if (!config.security.jwt.secret) {
            throw new Error('JWT secret is not defined in the environment');
        }

        const decoded = jwt.verify(token, config.security.jwt.secret) as JWTPayload;

        if (!decoded) {
            throw new AuthenticationError('Invalid authentication token');
        }

        (req as any).user = decoded;
        req.userId = decoded.id;
        req.userRole = decoded.role;

        AppLogger.debug('User authenticated', {
            userId: req.userId,
            userRole: req.userRole,
            requestId: (req as any).id,
        });

        next();
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            throw new AuthenticationError('Invalid authentication token');
        }

        if (error instanceof jwt.TokenExpiredError) {
            throw new AuthenticationError('Authentication token has expired');
        }
        if (error instanceof jwt.NotBeforeError) {
            throw new AuthenticationError('Authentication token is not yet valid');
        }

        if (error instanceof Error) {
            AppLogger.error(`Authentication error: ${error.message}`, {
                requestId: (req as any).id,
            });
            next(error);
        } else {
            AppLogger.error('Unknown authentication error', {
                requestId: (req as any).id,
            });
            next(new AuthenticationError('Unknown authentication error'));
        }
    }
};

/**
 * Middleware to check if user has required role
 */

export const authorize = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const userRole = req.userRole;

        if (!userRole) {
            throw new AuthenticationError('User not authenticated');
        }

        if (!roles.includes(userRole)) {
            AppLogger.warn(`Access denied. User does not have ${userRole} role`, {
                requestId: req.id,
                userId: req.userId,
                userRole,
                requiredRoles: roles,
            });
            throw new AuthorizationError(
                `Access denied. User does not have ${roles.join(', ')} role`
            );
        }
        AppLogger.debug('User authorized successfully', {
            userId: (req as any).userId,
            userRole,
            requestId: (req as any).id,
        });
        next();
    };
};
