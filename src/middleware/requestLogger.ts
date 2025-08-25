import { AppLogger } from '@/core/logging/logger';
import { Request, Response, NextFunction } from 'express';

export function requestLogger() {
    return (req: Request, res: Response, next: NextFunction) => {
        const start = Date.now();

        // Log request
        AppLogger.info(`${req.method} ${req.path}`, {
            requestId: req.id,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            query: req.query,
            params: req.params,
        });

        // Log response
        res.on('finish', () => {
            const duration = Date.now() - start;
            AppLogger.info(`${req.method} ${req.path} ${res.statusCode}`, {
                requestId: req.id,
                statusCode: res.statusCode,
                duration: `${duration}ms`,
                contentLength: res.get('Content-Length'),
            });
        });

        next();
    };
}
