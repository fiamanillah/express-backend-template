import { IgnitorApp } from './core/IgnitorApp';
import { AppLogger } from './core/logging/logger';

// Environment configuration
const PORT = parseInt(process.env.PORT || '3000');
const NODE_ENV = process.env.NODE_ENV || 'development';

// Main application bootstrap function
async function bootstrap() {
    try {
        // Initialize the Ignitor application
        const app = new IgnitorApp();

        // Register application modules

        // Start the server
        await app.spark(PORT);

        // Handle shutdown gracefully
        process.on('SIGTERM', () => shutdown(app));
        process.on('SIGINT', () => shutdown(app));
    } catch (error) {
        AppLogger.error('Failed to initialize application:', error);
        process.exit(1);
    }
}

// Graceful shutdown handler
async function shutdown(app: IgnitorApp) {
    AppLogger.info('Shutting down server gracefully...');

    // Add any cleanup logic here
    await app.getContext().prisma?.$disconnect();

    AppLogger.info('Server shutdown complete');
    process.exit(0);
}

// Start the application
bootstrap().catch(err => {
    AppLogger.error('Bootstrap error:', err);
    process.exit(1);
});
