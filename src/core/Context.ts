import { PrismaClient } from '@prisma/client';
import { AppLogger } from './logging/logger';
import { config } from './config';

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
            AppLogger.info('🗄️ Database connected successfully');
        } catch (error) {
            AppLogger.error('❌ Database connection failed', error);
            throw error;
        }
    }

    public async shutdown(): Promise<void> {
        try {
            await this.prisma.$disconnect();
            AppLogger.info('🗄️ Database disconnected successfully');
        } catch (error) {
            AppLogger.error('❌ Database disconnection failed', error);
            throw error;
        }
    }
}
