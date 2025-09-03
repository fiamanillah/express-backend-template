import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { AppError, RateLimitError, TimeoutError } from './errors/AppError';
import { errorHandler } from './errors/errorHandler';

import { Context } from './Context';
import { IgnitorModule } from './IgnitorModule';
import { AppLogger } from './logging/logger';
import { config } from './config';
import { requestLogger } from '@/middleware/requestLogger';
import { HTTPStatusCode } from '@/types/HTTPStatusCode';
import { asyncHandler } from '@/middleware/asyncHandler';
import { notFoundHandler } from '@/middleware/notFound';
import { BaseModule } from './BaseModule';
import { requestId } from '@/middleware/requestId';

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
        // Trust proxy (important for rate limiting and IP detection)
        this.app.set('trust proxy', 1);

        // Request ID middleware (must be first)
        this.app.use(requestId());

        // Security middlewares
        this.app.use(
            helmet({
                contentSecurityPolicy: config.server.isProduction,
                crossOriginEmbedderPolicy: config.server.isProduction,
            })
        );

        this.app.use(
            cors({
                origin: this.getConfiguredOrigins(),
                credentials: true,
                optionsSuccessStatus: 200,
            })
        );

        // Request parsing with size limits and error handling
        this.app.use(
            express.json({
                limit: '10mb',
                verify: (req, res, buf) => {
                    // Store raw body for webhook signature verification if needed
                    (req as any).rawBody = buf;
                },
            })
        );

        this.app.use(
            express.urlencoded({
                extended: true,
                limit: '10mb',
            })
        );

        this.app.use(
            compression({
                filter: (req, res) => {
                    if (req.headers['x-no-compression']) {
                        return false;
                    }
                    return compression.filter(req, res);
                },
            })
        );

        // Request timeout middleware
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            const timeout = setTimeout(() => {
                if (!res.headersSent) {
                    next(new TimeoutError('Request timeout'));
                }
            }, config.server.requestTimeout || 30000);

            res.on('finish', () => clearTimeout(timeout));
            res.on('close', () => clearTimeout(timeout));

            next();
        });

        // Request logging
        this.app.use(requestLogger());

        // Rate limiting
        if (config.server.isProduction) {
            this.app.use(
                rateLimit({
                    windowMs: config.security.rateLimit.windowMs,
                    max: config.security.rateLimit.max,
                    standardHeaders: true,
                    legacyHeaders: false,
                    handler: (req: Request, res: Response, next: NextFunction) => {
                        next(new RateLimitError());
                    },
                    skip: req => {
                        // Skip rate limiting for health check
                        return req.path === '/health';
                    },
                })
            );
        }

        // Health check endpoint
        this.app.get(
            '/health',
            asyncHandler(async (req: Request, res: Response) => {
                try {
                    // Check database connection
                    await this.context.prisma.$queryRaw`SELECT 1`;

                    // Uptime conversion function
                    const formatUptime = (seconds: number) => {
                        const days = Math.floor(seconds / (3600 * 24));
                        seconds %= 3600 * 24;
                        const hours = Math.floor(seconds / 3600);
                        seconds %= 3600;
                        const minutes = Math.floor(seconds / 60);
                        seconds = Math.floor(seconds % 60);
                        return `${days}d ${hours}h ${minutes}m ${seconds}s`;
                    };

                    // Memory formatting
                    const formatMemory = (bytes: number) =>
                        `${(bytes / 1024 / 1024).toFixed(2)} MB`;

                    // CPU usage formatting
                    const formatCPU = (cpuUsage: NodeJS.CpuUsage) =>
                        `User: ${(cpuUsage.user / 1000).toFixed(2)}ms, System: ${(
                            cpuUsage.system / 1000
                        ).toFixed(2)}ms`;

                    const uptimeSeconds = process.uptime();
                    const healthData = {
                        status: 'healthy',
                        timestamp: new Date().toISOString(),
                        uptime: formatUptime(uptimeSeconds),
                        environment: config.server.env,
                        version: process.env.npm_package_version || '1.0.0',
                        memoryUsage: {
                            rss: formatMemory(process.memoryUsage().rss),
                            heapTotal: formatMemory(process.memoryUsage().heapTotal),
                            heapUsed: formatMemory(process.memoryUsage().heapUsed),
                            external: formatMemory(process.memoryUsage().external),
                            arrayBuffers: formatMemory(process.memoryUsage().arrayBuffers),
                        },
                        cpuUsage: formatCPU(process.cpuUsage()),
                    };

                    res.status(200).json(healthData);
                } catch (error) {
                    throw new AppError(
                        HTTPStatusCode.SERVICE_UNAVAILABLE,
                        'Service unhealthy',
                        'SERVICE_UNAVAILABLE',
                        { reason: 'Database connection failed' }
                    );
                }
            })
        );
    }

    public registerModule(module: IgnitorModule): void {
        this.modules.push(module);
        AppLogger.info(`🧩 Registered module: ${module.name}`);
    }

    private async registerModuleRoutes(): Promise<void> {
        // Register routes from all modules
        for (const module of this.modules) {
            if (module instanceof BaseModule) {
                const moduleRouter = module.getRouter();
                this.app.use('/', moduleRouter);
                AppLogger.info(`🛣️ Registered routes for module: ${module.name}`);
            }
        }
    }

    private sortModulesByDependencies(): IgnitorModule[] {
        const sorted: IgnitorModule[] = [];
        const visited: Set<string> = new Set();
        const temp: Set<string> = new Set();

        const visit = (module: IgnitorModule) => {
            if (temp.has(module.name)) {
                throw new AppError(
                    HTTPStatusCode.INTERNAL_SERVER_ERROR,
                    `Circular dependency detected: ${module.name}`,
                    'CIRCULAR_DEPENDENCY'
                );
            }

            if (!visited.has(module.name)) {
                temp.add(module.name);

                if (module.dependencies) {
                    module.dependencies.forEach(depName => {
                        const dep = this.modules.find(m => m.name === depName);
                        if (!dep) {
                            throw new AppError(
                                HTTPStatusCode.INTERNAL_SERVER_ERROR,
                                `Dependency ${depName} not found for module ${module.name}`,
                                'MISSING_DEPENDENCY'
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
                AppLogger.info(`🔧 Initializing module: ${module.name}`);
                await module.initialize(this.context);
                AppLogger.info(`✅ Module ${module.name} initialized successfully`);
            } catch (error) {
                const appError = new AppError(
                    HTTPStatusCode.INTERNAL_SERVER_ERROR,
                    `Failed to initialize module ${module.name}`,
                    'MODULE_INITIALIZATION_ERROR',
                    {
                        module: module.name,
                        originalError: error instanceof Error ? error.message : String(error),
                    }
                );

                AppLogger.error(`❌ ${appError.message}`, {
                    error: appError,
                    context: 'module-initialization',
                });

                throw appError;
            }
        }
    }

    public async spark(port: number): Promise<void> {
        try {
            AppLogger.info('✅ Configuration loaded successfully');

            AppLogger.info('🔧 Initializing context...');
            await this.context.initialize();

            AppLogger.info('🔧 Initializing modules...');
            await this.initializeModules();

            AppLogger.info('🛣️ Registering module routes...');
            await this.registerModuleRoutes();

            // 404 handler (must be after all routes but before error handler)
            this.app.use(notFoundHandler());

            // Global error handler (must be last)
            this.app.use(errorHandler());

            AppLogger.info('🚀 Starting server...');
            const server = this.app.listen(port, () => {
                AppLogger.info(
                    `⚡️ Ignitor Server running on port ${port} in ${config.server.env} mode`
                );
            });

            // Handle server errors
            server.on('error', (err: NodeJS.ErrnoException) => {
                if (err.code === 'EADDRINUSE') {
                    throw new AppError(
                        HTTPStatusCode.INTERNAL_SERVER_ERROR,
                        `Port ${port} is already in use`,
                        'PORT_IN_USE'
                    );
                }
                throw err;
            });

            // Graceful shutdown handling
            const shutdownSignals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
            shutdownSignals.forEach(signal => {
                process.on(signal, async () => {
                    AppLogger.info(`🛑 Received ${signal}, starting graceful shutdown...`);

                    server.close(async () => {
                        try {
                            await this.shutdown();
                            process.exit(0);
                        } catch (error) {
                            AppLogger.error('❌ Error during shutdown:', { error });
                            process.exit(1);
                        }
                    });

                    setTimeout(() => {
                        AppLogger.error('⚠️ Forced shutdown due to timeout');
                        process.exit(1);
                    }, 30000);
                });
            });

            AppLogger.info('✅ Server setup complete');
        } catch (error) {
            AppLogger.error('❌ Failed to start server:', {
                error: error instanceof Error ? error : new Error(String(error)),
                context: 'server-start',
            });
            throw error;
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
        AppLogger.info('🛠️ Shutting down application...');

        // Shutdown modules in reverse order
        for (let i = this.modules.length - 1; i >= 0; i--) {
            const module = this.modules[i];
            if (module.onShutdown) {
                try {
                    AppLogger.info(`🧩 Shutting down module: ${module.name}`);
                    await module.onShutdown();
                } catch (error) {
                    AppLogger.error(`❌ Error shutting down module ${module.name}`, {
                        error: error instanceof Error ? error : new Error(String(error)),
                        module: module.name,
                        context: 'module-shutdown',
                    });
                }
            }
        }

        // Shutdown context
        await this.context.shutdown();
        AppLogger.info('✅ Application shutdown complete');
    }
}
