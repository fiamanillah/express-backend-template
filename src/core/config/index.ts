import dotenv from 'dotenv';
import path from 'path';
import { AppLogger } from '../logging/logger';

// Load environment variables
dotenv.config({
    path: path.resolve(
        process.cwd(),
        `.env${process.env.NODE_ENV ? `.${process.env.NODE_ENV}` : ''}`
    ),
});

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'PORT'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    AppLogger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
}

// Configuration object
export const config = {
    // Server configuration
    server: {
        port: parseInt(process.env.PORT || '3000'),
        env: process.env.NODE_ENV || 'development',
        isProduction: process.env.NODE_ENV === 'production',
        isDevelopment: process.env.NODE_ENV === 'development',
        isTest: process.env.NODE_ENV === 'test',
    },

    // Database configuration
    database: {
        url: process.env.DATABASE_URL as string,
        logging: process.env.DB_LOGGING === 'true',
        pool: {
            min: parseInt(process.env.DB_POOL_MIN || '2'),
            max: parseInt(process.env.DB_POOL_MAX || '10'),
        },
    },

    // Security configuration
    security: {
        cors: {
            allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
        },
        rateLimit: {
            windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
            max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
        },
    },

    // Logging configuration
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        file: {
            enabled: process.env.LOG_TO_FILE === 'true',
            path: process.env.LOG_FILE_PATH || 'logs/app.log',
        },
    },

    // JWT configuration (if using authentication)
    jwt: {
        secret: process.env.JWT_SECRET as string,
        expiresIn: process.env.JWT_EXPIRES_IN || '1d',
        issuer: process.env.JWT_ISSUER || 'ignitor-app',
    },
};

// Freeze the config object to prevent modifications
Object.freeze(config);

// Type for the config object
export type AppConfig = typeof config;
