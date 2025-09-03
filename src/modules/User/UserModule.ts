// src/modules/User/UserModule.ts
import { BaseModule } from '@/core/BaseModule';
import { Context } from '@/core/Context';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserRoutes } from './user.routes';

export class UserModule extends BaseModule {
    public readonly name = 'UserModule';
    public readonly version = '1.0.0';
    public readonly dependencies = []; // No dependencies for this module

    private userService!: UserService;
    private userController!: UserController;
    private userRoutes!: UserRoutes;

    /**
     * Setup module services
     */
    protected async setupServices(): Promise<void> {
        // Initialize service
        this.userService = new UserService(this.context.prisma);
    }

    /**
     * Setup module routes
     */
    protected async setupRoutes(): Promise<void> {
        // Initialize controller
        this.userController = new UserController(this.userService);

        // Initialize routes
        this.userRoutes = new UserRoutes(this.userController);

        // Mount routes under /api/users
        this.router.use('/api/users', this.userRoutes.getRouter());
    }

    /**
     * Custom initialization logic before services setup
     */
    protected async onBeforeInit(): Promise<void> {
        // Perform any pre-initialization tasks
        // For example, you might want to validate database tables exist
        try {
            await this.context.prisma.user.findFirst();
        } catch (error) {
            throw new Error('User table not found. Please run database migrations.');
        }
    }

    /**
     * Custom initialization logic after routes setup
     */
    protected async onAfterInit(): Promise<void> {
        // Perform any post-initialization tasks
        // For example, create default data, setup caches, etc.
    }

    /**
     * Module-specific health check
     */
    public async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details?: any }> {
        try {
            // Check if we can query the database
            const userCount = await this.userService.count();

            return {
                status: 'healthy',
                details: {
                    totalUsers: userCount,
                    lastChecked: new Date().toISOString(),
                },
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                details: {
                    error: error instanceof Error ? error.message : String(error),
                    lastChecked: new Date().toISOString(),
                },
            };
        }
    }

    /**
     * Cleanup resources when module is shutting down
     */
    protected async cleanup(): Promise<void> {
        // Perform cleanup tasks
        // For example, close connections, clear caches, etc.
        // The UserService uses the shared Prisma client, so no cleanup needed here
    }

    // Getter methods for accessing module components (useful for testing)
    public getUserService(): UserService {
        return this.userService;
    }

    public getUserController(): UserController {
        return this.userController;
    }
}
