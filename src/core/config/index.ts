import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ override: false });

// Validate and parse configuration
export const config = {
    server: {
        port: parseInt(process.env.PORT || '3000'),
        env: process.env.NODE_ENV,
        isProduction: process.env.NODE_ENV === 'production',
        isDevelopment: process.env.NODE_ENV === 'development',
        isTest: process.env.NODE_ENV === 'test',
        requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000'),
    },
    database: {
        url: process.env.DATABASE_URL,
        logging: process.env.DB_LOGGING === 'true',
        pool: {
            min: parseInt(process.env.DB_POOL_MIN || '2'),
            max: parseInt(process.env.DB_POOL_MAX || '10'),
        },
    },
    security: {
        cors: {
            allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
        },
        rateLimit: {
            windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
            max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
        },
        jwt: {
            secret: process.env.JWT_SECRET,
            expiresIn: process.env.JWT_EXPIRES_IN || '1d',
            issuer: process.env.JWT_ISSUER || 'ignitor-app',
        },
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        file: {
            enabled: process.env.LOG_TO_FILE === 'true',
            path: process.env.LOG_FILE_PATH || 'logs/app.log',
        },
    },
};
