import { PrismaClient } from '@prisma/client';
import { config } from './config';
import { AppLogger } from './logging/logger';

export class Context {
    public prisma: PrismaClient;
    public config: typeof config;

    constructor() {
        this.prisma = new PrismaClient();
        this.config = config;
    }

    public async initialize(): Promise<void> {
        try {
            await this.prisma.$connect();
            AppLogger.info('Database connected successfully');
        } catch (error) {
            AppLogger.error('Database connection failed', error);
            throw error;
        }
    }
}
