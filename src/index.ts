// src/index.ts
import { IgnitorApp } from './core/IgnitorApp';
import { UserModule } from './modules/User/UserModule';
import { AppLogger } from './core/logging/logger';
import { config } from './core/config';

// Main application bootstrap function
async function bootstrap() {
    try {
        AppLogger.info('📦 Starting application bootstrap');

        // Initialize the Ignitor application
        const app = new IgnitorApp();

        AppLogger.info('🔧 Registering modules...');

        // Register application modules
        app.registerModule(new UserModule());

        AppLogger.info('✅ All modules registered successfully');

        // Start the server
        await app.spark(config.server.port);

        // Handle shutdown gracefully
        process.on('SIGTERM', () => shutdown(app));
        process.on('SIGINT', () => shutdown(app));

        AppLogger.info('💥 Ignitor sparked successfully');
    } catch (error) {
        AppLogger.error('❌ Bootstrap error details:', error);

        AppLogger.error('🔴 Failed to initialize application:', {
            error: error instanceof Error ? error : new Error(String(error)),
            context: 'application-initialization',
            stack: error instanceof Error ? error.stack : undefined,
            message: error instanceof Error ? error.message : String(error),
        });
        process.exit(1);
    }
}

// Graceful shutdown handler
async function shutdown(app: IgnitorApp) {
    AppLogger.info('Received shutdown signal, shutting down gracefully...');

    try {
        await app.shutdown();
        AppLogger.info('Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        AppLogger.error('❌ Shutdown error details:', error);

        AppLogger.error('Error during graceful shutdown:', {
            error: error instanceof Error ? error : new Error(String(error)),
            context: 'graceful-shutdown',
            stack: error instanceof Error ? error.stack : undefined,
        });
        process.exit(1);
    }
}

// Start the application
bootstrap().catch(err => {
    AppLogger.error('❌ Unhandled bootstrap error:', err);
    AppLogger.error('Bootstrap error:', {
        error: err instanceof Error ? err : new Error(String(err)),
        stack: err instanceof Error ? err.stack : undefined,
    });
    process.exit(1);
});
