export class AppError extends Error {
    constructor(
        public statusCode: number,
        public message: string,
        public code?: string,
        public details?: unknown
    ) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class NotFoundError extends AppError {
    constructor(message = 'Resource not found', details?: unknown) {
        super(404, message, 'NOT_FOUND', details);
    }
}

export class ValidationError extends AppError {
    constructor(message = 'Validation failed', details?: unknown) {
        super(400, message, 'VALIDATION_ERROR', details);
    }
}

export class AuthenticationError extends AppError {
    constructor(message = 'Authentication required', details?: unknown) {
        super(401, message, 'AUTHENTICATION_ERROR', details);
    }
}

export class AuthorizationError extends AppError {
    constructor(message = 'Permission denied', details?: unknown) {
        super(403, message, 'AUTHORIZATION_ERROR', details);
    }
}
