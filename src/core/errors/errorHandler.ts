import { Request, Response, NextFunction } from 'express';
import { AppError } from '@/core/errors/AppError';
import { isPlainObject } from 'lodash';
import { AppLogger } from '../logging/logger';

interface ErrorResponse {
    success: false;
    error: {
        message: string;
        code?: string;
        details?: unknown;
        timestamp?: string;
        path?: string;
        method?: string;
    };
}

export function errorHandler(logger: AppLogger) {
    return (err: unknown, req: Request, res: Response, next: NextFunction) => {
        // Extract error information
        const error = err instanceof Error ? err : new Error(String(err));
        const isAppError = err instanceof AppError;
        const isDevelopment = process.env.NODE_ENV === 'development';

        // Prepare error details for logging
        const logDetails = {
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
                ...(isAppError && {
                    code: err.code,
                    statusCode: err.statusCode,
                    details: err.details,
                }),
            },
            request: {
                method: req.method,
                path: req.path,
                params: req.params,
                query: req.query,
                body: req.body,
                ip: req.ip,
                user: (req as any).user?.id, // Assuming user might be attached to request
            },
        };

        // Log the error with context
        AppLogger.error('Request processing error', logDetails);

        // Prepare client response
        const response: ErrorResponse = {
            success: false,
            error: {
                message: isAppError ? error.message : 'Internal Server Error',
                ...(isAppError && { code: err.code }),
                ...(isDevelopment && {
                    details: isAppError
                        ? err.details
                        : error.stack?.split('\n').map(line => line.trim()),
                }),
                timestamp: new Date().toISOString(),
                path: req.path,
                method: req.method,
            },
        };

        // Send response with appropriate status code
        res.status(isAppError ? err.statusCode : 500).json(response);

        // In development, consider logging to console as well
        if (isDevelopment) {
            console.error('Error handler:', error);
        }
    };
}
