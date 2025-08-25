import dotenv from 'dotenv';
import path from 'path';

// Simple console logger for config loading (avoids circular dependencies)
function configLogger(message: string, error?: unknown) {
    const timestamp = new Date().toISOString();
    if (error) {
        console.error(`❌ [${timestamp}] CONFIG ERROR: ${message}`, error);
    } else {
        console.log(`✅ [${timestamp}] CONFIG: ${message}`);
    }
}

// Load environment variables
dotenv.config({
    path: path.resolve(
        process.cwd(),
        `.env${process.env.NODE_ENV ? `.${process.env.NODE_ENV}` : ''}`
    ),
});

// Validate and parse configuration
function loadConfig() {
    try {
        const config = {
            server: {
                port: parseInt(process.env.PORT || '3000'),
                env: process.env.NODE_ENV || 'development',
                isProduction: process.env.NODE_ENV === 'production',
                isDevelopment: process.env.NODE_ENV === 'development',
                isTest: process.env.NODE_ENV === 'test',
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

        configLogger('Configuration loaded successfully');
        return config;
    } catch (error) {
        configLogger('Invalid configuration', error);
        process.exit(1);
    }
}

export const config = loadConfig();
