import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { AppError } from './errors/AppError';
import { errorHandler } from './errors/errorHandler';
import { Context } from './Context';
import { IgnitorModule } from './IgnitorModule';
import { Logger, loggers } from 'winston';
import { AppLogger } from './logging/logger';

export class IgnitorApp {
    private app: Express;
    private context: Context;
    private modules: IgnitorModule[] = [];
    private isProduction: boolean;

    constructor() {
        this.app = express();
        this.isProduction = process.env.NODE_ENV === 'production';
        this.context = new Context();

        this.initializeCore();
    }

    private initializeCore(): void {
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

        // Rate limiting
        if (this.isProduction) {
            this.app.use(
                rateLimit({
                    windowMs: 15 * 60 * 1000, // 15 minutes
                    max: 100, // limit each IP to 100 requests per windowMs
                    handler: (req, res) => {
                        throw new AppError(429, 'Too many requests', 'RATE_LIMIT_EXCEEDED');
                    },
                })
            );
        }

        // Request logging
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            AppLogger.info(`${req.method} ${req.path}`);
            next();
        });

        // Health check endpoint
        this.app.get('/health', (req: Request, res: Response) => {
            res.status(200).json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
            });
        });
    }

    public registerModule(module: IgnitorModule): void {
        this.modules.push(module);
        AppLogger.debug(`Module registered: ${module.name}`);
    }

    public async initializeModules(): Promise<void> {
        for (const module of this.modules) {
            try {
                AppLogger.info(`Initializing module: ${module.name}`);
                await module.initialize(this.context);
                AppLogger.info(`Module initialized: ${module.name}`);
            } catch (error) {
                AppLogger.error(`Failed to initialize module ${module.name}`, error);
                throw error;
            }
        }
    }

    public async spark(port: number): Promise<void> {
        try {
            await this.context.initialize();
            await this.initializeModules();

            // Error handling (must be after all routes)
            this.app.use(errorHandler(AppLogger));

            // 404 handler
            this.app.use((req: Request, res: Response) => {
                throw new AppError(404, 'Endpoint not found', 'NOT_FOUND');
            });

            this.app.listen(port, () => {
                AppLogger.info(
                    `Server running on port ${port} in ${
                        process.env.NODE_ENV || 'development'
                    } mode`
                );
            });
        } catch (error) {
            AppLogger.error('Failed to start server:', error);
            process.exit(1);
        }
    }

    public getApp(): Express {
        return this.app;
    }

    public getContext(): Context {
        return this.context;
    }

    private getConfiguredOrigins(): string[] | string {
        const origins = process.env.ALLOWED_ORIGINS?.split(',') || [];
        return this.isProduction && origins.length > 0 ? origins : '*';
    }
}
