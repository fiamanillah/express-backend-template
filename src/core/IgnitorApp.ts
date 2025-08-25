import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';

import { AppError } from './errors/AppError';
import { errorHandler } from './errors/errorHandler';
import { Context } from './Context';
import { IgnitorModule } from './IgnitorModule';
import { AppLogger } from './logging/logger';
import { config } from './config';
import { RequestLogMeta } from '@/types/logging';
import { requestLogger } from '@/middleware/requestLogger';

// Extend Express Request interface
declare global {
    namespace Express {
        interface Request {
            id: string;
        }
    }
}

export class IgnitorApp {
    private app: Express;
    private context: Context;
    private modules: IgnitorModule[] = [];

    constructor() {
        this.app = express();
        this.context = new Context();

        this.initializeCore();
    }

    private initializeCore(): void {
        // Request ID middleware
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            req.id = uuidv4();
            next();
        });

        // Security middlewares
        this.app.use(helmet());
        this.app.use(
            cors({
                origin: this.getConfiguredOrigins(),
                credentials: true,
            })
        );

        // Request processing
        this.app.use(express.json({ limit: '10kb' }));
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use(compression());

        // Request logging - SINGLE LOGGER ONLY
        this.app.use(requestLogger());

        // Rate limiting - FIXED: Don't throw errors in handler
        if (config.server.isProduction) {
            this.app.use(
                rateLimit({
                    windowMs: config.security.rateLimit.windowMs,
                    max: config.security.rateLimit.max,
                    handler: (req: Request, res: Response) => {
                        // DON'T throw error here - just send response
                        res.status(429).json({
                            success: false,
                            error: {
                                message: 'Too many requests',
                                code: 'RATE_LIMIT_EXCEEDED',
                            },
                        });
                    },
                })
            );
        }

        // Health check endpoint - FIXED: Proper async error handling
        this.app.get('/health', async (req: Request, res: Response, next: NextFunction) => {
            try {
                // Check database connection
                await this.context.prisma.$queryRaw`SELECT 1`;

                res.status(200).json({
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime(),
                    environment: config.server.env,
                });
            } catch (error) {
                // Pass error to error handler instead of handling here
                next(new AppError(503, 'Database connection failed', 'DATABASE_CONNECTION_FAILED'));
            }
        });
    }

    public registerModule(module: IgnitorModule): void {
        // Check for circular dependencies
        this.modules.push(module);
        AppLogger.info(`Registered module: ${module.name}`);
    }

    private sortModulesByDependencies(): IgnitorModule[] {
        const sorted: IgnitorModule[] = [];
        const visited: Set<string> = new Set();
        const temp: Set<string> = new Set();

        const visit = (module: IgnitorModule) => {
            if (temp.has(module.name)) {
                throw new Error(`Circular dependency detected: ${module.name}`);
            }

            if (!visited.has(module.name)) {
                temp.add(module.name);

                // Process dependencies first
                if (module.dependencies) {
                    module.dependencies.forEach(depName => {
                        const dep = this.modules.find(m => m.name === depName);
                        if (!dep) {
                            throw new Error(
                                `Dependency ${depName} not found for module ${module.name}`
                            );
                        }
                        visit(dep);
                    });
                }

                temp.delete(module.name);
                visited.add(module.name);
                sorted.push(module);
            }
        };

        this.modules.forEach(visit);
        return sorted;
    }

    public async initializeModules(): Promise<void> {
        const sortedModules = this.sortModulesByDependencies();

        for (const module of sortedModules) {
            try {
                AppLogger.info(`Initializing module: ${module.name}`);
                await module.initialize(this.context);
                AppLogger.info(`Module ${module.name} initialized successfully`);
            } catch (error) {
                AppLogger.error(`Failed to initialize module ${module.name}`, {
                    error: error instanceof Error ? error : new Error(String(error)),
                    module: module.name,
                    context: 'module-initialization',
                });
                throw error;
            }
        }
    }

    public async spark(port: number): Promise<void> {
        try {
            AppLogger.info('🔧 Initializing context...');
            await this.context.initialize();

            AppLogger.info('🔧 Initializing modules...');
            await this.initializeModules();

            AppLogger.info('🔧 Setting up 404 handler...');
            // FIXED: 404 handler FIRST, then error handler
            // 404 handler - Must be BEFORE error handler
            this.app.use((req: Request, res: Response, next: NextFunction) => {
                next(new AppError(404, 'Endpoint not found', 'NOT_FOUND'));
            });

            AppLogger.info('🔧 Setting up error handler...');
            // Error handling (must be LAST)
            this.app.use(errorHandler());

            AppLogger.info('🔧 Starting server listen...');
            const server = this.app.listen(port, () => {
                AppLogger.info(`Server running on port ${port} in ${config.server.env} mode`);
            });

            // Handle server errors
            server.on('error', err => {
                console.error('❌ Server error:', err);
                throw err;
            });

            AppLogger.info('✅ Server setup complete');
        } catch (error) {
            console.error('❌ Spark error details:', error);
            AppLogger.error('Failed to start server:', {
                error: error instanceof Error ? error : new Error(String(error)),
                context: 'server-start',
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error; // Re-throw instead of process.exit to let bootstrap handle it
        }
    }

    public getApp(): Express {
        return this.app;
    }

    public getContext(): Context {
        return this.context;
    }

    private getConfiguredOrigins(): string[] | string {
        return config.server.isProduction && config.security.cors.allowedOrigins.length > 0
            ? config.security.cors.allowedOrigins
            : '*';
    }

    public async shutdown(): Promise<void> {
        AppLogger.info('Shutting down application...');

        // Shutdown modules in reverse order
        for (let i = this.modules.length - 1; i >= 0; i--) {
            const module = this.modules[i];
            if (module.onShutdown) {
                try {
                    AppLogger.info(`Shutting down module: ${module.name}`);
                    await module.onShutdown();
                } catch (error) {
                    AppLogger.error(`Error shutting down module ${module.name}`, {
                        error: error instanceof Error ? error : new Error(String(error)),
                        module: module.name,
                        context: 'module-shutdown',
                    });
                }
            }
        }

        // Shutdown context
        await this.context.shutdown();

        AppLogger.info('Application shutdown complete');
    }
}
