import { PrismaClient } from '@prisma/client';
import { Logger } from 'winston';
import { config } from './config';

export class Context {
    public prisma: PrismaClient;
    public logger: Logger;
    public config: typeof config;

    constructor() {
        this.prisma = new PrismaClient();
        this.logger = new Logger();
        this.config = config;
    }

    public async initialize(): Promise<void> {
        try {
            await this.prisma.$connect();
            this.logger.info('Database connected successfully');
        } catch (error) {
            this.logger.error('Database connection failed', error);
            throw error;
        }
    }
}
