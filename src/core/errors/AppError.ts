export class AppError extends Error {
    constructor(
        public statusCode: number,
        public message: string,
        public code?: string,
        public details?: any
    ) {
        super(message);
        Object.setPrototypeOf(this, AppError.prototype);
    }
}

export class NotFoundError extends AppError {
    constructor(message = 'Resource not found', details?: any) {
        super(404, message, 'NOT_FOUND', details);
    }
}

export class ValidationError extends AppError {
    constructor(message = 'Validation failed', details?: any) {
        super(400, message, 'VALIDATION_ERROR', details);
    }
}
