import { ValidationError } from '@/core/errors/AppError';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export function validateRequest(schema: {
    body?: z.ZodSchema;
    query?: z.ZodSchema;
    params?: z.ZodSchema;
}) {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            if (schema.body) {
                req.body = schema.body.parse(req.body);
            }

            if (schema.query) {
                const parsedQuery = schema.query.parse(req.query);
                req.query = parsedQuery as any;
            }

            if (schema.params) {
                const parsedParams = schema.params.parse(req.params);
                req.params = parsedParams as any;
            }

            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                next(
                    new ValidationError('Validation failed', {
                        issues: error.issues.map(issue => ({
                            path: issue.path.join('.'),
                            message: issue.message,
                            code: issue.code,
                        })),
                    })
                );
            } else {
                next(error);
            }
        }
    };
}
