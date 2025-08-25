import { Request, Response, NextFunction } from 'express';
import { AppError } from './AppError';
import { AppLogger } from '../logging/logger';

export function errorHandler() {
    return (err: unknown, req: Request, res: Response, next: NextFunction) => {
        // CRITICAL: Check if response was already sent
        if (res.headersSent) {
            return next(err);
        }

        const error = err instanceof Error ? err : new Error(String(err));
        const isAppError = err instanceof AppError;

        // Auto-log errors (no need for manual logging in each route)
        if (isAppError && (err as AppError).statusCode < 500) {
            AppLogger.warn(error.message, {
                code: (err as AppError).code,
                statusCode: (err as AppError).statusCode,
                path: req.path,
                requestId: req.id,
            });
        } else {
            AppLogger.error(error.message, {
                stack: error.stack,
                path: req.path,
                requestId: req.id,
            });
        }

        // Client response
        const statusCode = isAppError ? (err as AppError).statusCode : 500;
        const message = isAppError ? error.message : 'Internal Server Error';
        const code = isAppError ? (err as AppError).code : 'INTERNAL_ERROR';

        res.status(statusCode).json({
            success: false,
            error: {
                message,
                code,
                ...(process.env.NODE_ENV === 'development' && {
                    details: isAppError ? (err as AppError).details : undefined,
                    stack: error.stack,
                }),
            },
        });
    };
}
