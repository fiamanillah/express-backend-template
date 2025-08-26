// types/express.d.ts - Type definitions for Express extensions
import { Request } from 'express';

declare global {
    namespace Express {
        interface Request {
            id: string;
            userId?: string;
            userRole?: string;
            rawBody?: Buffer;
        }
    }
}

// types/validation.ts - Better validation types
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '../errors/AppError';

interface ValidationSchemas {
    body?: z.ZodSchema<any>;
    query?: z.ZodSchema<any>;
    params?: z.ZodSchema<any>;
    headers?: z.ZodSchema<any>;
}

export function validateRequest(schemas: ValidationSchemas) {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const errors: Array<{ field: string; message: string }> = [];

            // Validate body
            if (schemas.body) {
                const result = schemas.body.safeParse(req.body);
                if (!result.success) {
                    result.error.issues.forEach(issue => {
                        errors.push({
                            field: `body.${issue.path.join('.')}`,
                            message: issue.message,
                        });
                    });
                } else {
                    req.body = result.data;
                }
            }

            // Validate query parameters
            if (schemas.query) {
                const result = schemas.query.safeParse(req.query);
                if (!result.success) {
                    result.error.issues.forEach(issue => {
                        errors.push({
                            field: `query.${issue.path.join('.')}`,
                            message: issue.message,
                        });
                    });
                } else {
                    // Safe assignment for query
                    Object.assign(req.query, result.data);
                }
            }

            // Validate route parameters
            if (schemas.params) {
                const result = schemas.params.safeParse(req.params);
                if (!result.success) {
                    result.error.issues.forEach(issue => {
                        errors.push({
                            field: `params.${issue.path.join('.')}`,
                            message: issue.message,
                        });
                    });
                } else {
                    // Safe assignment for params
                    Object.assign(req.params, result.data);
                }
            }

            // Validate headers
            if (schemas.headers) {
                const result = schemas.headers.safeParse(req.headers);
                if (!result.success) {
                    result.error.issues.forEach(issue => {
                        errors.push({
                            field: `headers.${issue.path.join('.')}`,
                            message: issue.message,
                        });
                    });
                }
            }

            // If there are validation errors, throw them
            if (errors.length > 0) {
                throw new ValidationError('Request validation failed', { errors });
            }

            next();
        } catch (error) {
            next(error);
        }
    };
}

// middleware/requestId.ts - Proper request ID middleware
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export function requestId() {
    return (req: Request, res: Response, next: NextFunction) => {
        // Check if request ID already exists (maybe from load balancer)
        const existingId = req.headers['x-request-id'] || req.headers['x-correlation-id'];

        req.id = typeof existingId === 'string' ? existingId : uuidv4();

        // Add request ID to response headers for debugging
        res.setHeader('x-request-id', req.id);

        next();
    };
}

// middleware/security.ts - Additional security middleware
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { HTTPStatusCode } from '@/types/HTTPStatusCode';

export function securityHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
        // Remove server header
        res.removeHeader('x-powered-by');

        // Add security headers
        res.setHeader('x-content-type-options', 'nosniff');
        res.setHeader('x-frame-options', 'DENY');
        res.setHeader('x-xss-protection', '1; mode=block');
        res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');

        // Add request size limits check
        const contentLength = parseInt(req.get('content-length') || '0');
        const maxSize = 10 * 1024 * 1024; // 10MB

        if (contentLength > maxSize) {
            return next(
                new AppError(
                    HTTPStatusCode.PAYLOAD_TOO_LARGE,
                    'Request payload too large',
                    'PAYLOAD_TOO_LARGE',
                    { maxSize, received: contentLength }
                )
            );
        }

        next();
    };
}

// utils/errorReporting.ts - Error reporting utilities
import { AppError } from '../errors/AppError';
import { AppLogger } from '../logging/logger';

interface ErrorContext {
    requestId?: string;
    userId?: string;
    path?: string;
    method?: string;
    userAgent?: string;
    ip?: string;
    timestamp?: string;
}

export class ErrorReporter {
    static async reportError(error: AppError | Error, context?: ErrorContext) {
        const errorData = {
            message: error.message,
            stack: error.stack,
            name: error.name,
            ...(error instanceof AppError
                ? {
                      statusCode: error.statusCode,
                      code: error.code,
                      isOperational: error.isOperational,
                      details: error.details,
                  }
                : {}),
            context,
            timestamp: new Date().toISOString(),
        };

        // Log locally
        AppLogger.error('Error reported', errorData);

        // Send to external error reporting service (Sentry, Bugsnag, etc.)
        try {
            // Example: await sentry.captureException(error, { contexts: { custom: context } });
            // Example: await bugsnag.notify(error, { metadata: { context } });
        } catch (reportingError) {
            AppLogger.error('Failed to report error to external service', {
                originalError: error.message,
                reportingError:
                    reportingError instanceof Error
                        ? reportingError.message
                        : String(reportingError),
            });
        }
    }
}

// utils/gracefulShutdown.ts - Graceful shutdown utilities
import { Server } from 'http';
import { AppLogger } from '../logging/logger';

interface ShutdownManager {
    server: Server;
    cleanup: Array<() => Promise<void>>;
}

export class GracefulShutdown {
    private static instance: GracefulShutdown;
    private shutdownManager?: ShutdownManager;
    private isShuttingDown = false;

    static getInstance(): GracefulShutdown {
        if (!this.instance) {
            this.instance = new GracefulShutdown();
        }
        return this.instance;
    }

    public setup(server: Server, cleanupTasks: Array<() => Promise<void>> = []) {
        this.shutdownManager = {
            server,
            cleanup: cleanupTasks,
        };

        // Handle different shutdown signals
        const shutdownSignals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

        shutdownSignals.forEach(signal => {
            process.on(signal, () => this.shutdown(signal));
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', error => {
            AppLogger.error('Uncaught Exception', { error, stack: error.stack });
            this.shutdown('uncaughtException');
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            AppLogger.error('Unhandled Rejection', {
                reason: reason instanceof Error ? reason.message : String(reason),
                stack: reason instanceof Error ? reason.stack : undefined,
                promise: String(promise),
            });
            this.shutdown('unhandledRejection');
        });
    }

    public addCleanupTask(task: () => Promise<void>) {
        if (this.shutdownManager) {
            this.shutdownManager.cleanup.push(task);
        }
    }

    private async shutdown(reason: string) {
        if (this.isShuttingDown) {
            AppLogger.warn('Shutdown already in progress, ignoring signal');
            return;
        }

        this.isShuttingDown = true;
        AppLogger.info(`Received ${reason}, starting graceful shutdown...`);

        if (!this.shutdownManager) {
            AppLogger.warn('No shutdown manager configured');
            process.exit(1);
            return;
        }

        const { server, cleanup } = this.shutdownManager;

        // Set a timeout for forced shutdown
        const forceShutdownTimeout = setTimeout(() => {
            AppLogger.error('Forced shutdown due to timeout');
            process.exit(1);
        }, 30000); // 30 seconds

        try {
            // Stop accepting new connections
            server.close(() => {
                AppLogger.info('HTTP server closed');
            });

            // Run cleanup tasks
            AppLogger.info(`Running ${cleanup.length} cleanup tasks...`);
            await Promise.allSettled(
                cleanup.map(async (task, index) => {
                    try {
                        await task();
                        AppLogger.info(`Cleanup task ${index + 1} completed`);
                    } catch (error) {
                        AppLogger.error(`Cleanup task ${index + 1} failed`, { error });
                    }
                })
            );

            clearTimeout(forceShutdownTimeout);
            AppLogger.info('Graceful shutdown completed');
            process.exit(0);
        } catch (error) {
            clearTimeout(forceShutdownTimeout);
            AppLogger.error('Error during shutdown', { error });
            process.exit(1);
        }
    }
}
