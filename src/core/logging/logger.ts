import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import chalk from 'chalk';
import { format as dateFnsFormat } from 'date-fns';

const { combine, timestamp, printf, errors } = format;

// Constants
const LOG_DIR = 'logs';
const MAX_FILE_SIZE = '5m'; // 5MB
const MAX_FILES = '14d'; // Keep 14 days of logs

// Emojis + Colors per log level
const levelStyles: Record<string, { emoji: string; color: (msg: string) => string }> = {
    error: { emoji: '❌', color: chalk.red.bold },
    warn: { emoji: '⚠️', color: chalk.yellow.bold },
    info: { emoji: 'ℹ️', color: chalk.cyan.bold },
    http: { emoji: '🌐', color: chalk.magenta.bold },
    verbose: { emoji: '🔍', color: chalk.blue },
    debug: { emoji: '🐛', color: chalk.green },
    silly: { emoji: '🤪', color: chalk.gray },
};

export class AppLogger {
    private static instance: ReturnType<typeof createLogger>;
    private static logDir = path.join(process.cwd(), LOG_DIR);

    private constructor() {} // Prevent instantiation

    private static initialize(): ReturnType<typeof createLogger> {
        if (!AppLogger.instance) {
            // Custom log format
            const logFormat = printf(({ level, message, timestamp, stack }) => {
                const style = levelStyles[level] || {
                    emoji: '📝',
                    color: chalk.white,
                };

                const time = chalk.dim(timestamp); // gray timestamp
                const lvl = style.color(level.toUpperCase().padEnd(7)); // aligned level
                const emoji = style.emoji;

                // Handle errors nicely (stack on new lines)
                const logMsg = message instanceof Error ? message.stack : stack || message;

                return `${emoji} ${time} ${lvl}  ${logMsg}`;
            });

            // File rotation transport
            const fileRotateTransport = new DailyRotateFile({
                filename: path.join(AppLogger.logDir, 'application-%DATE%.log'),
                datePattern: 'YYYY-MM-DD',
                zippedArchive: true,
                maxSize: MAX_FILE_SIZE,
                maxFiles: MAX_FILES,
                format: combine(errors({ stack: true }), timestamp(), logFormat),
            });

            AppLogger.instance = createLogger({
                level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
                format: combine(
                    errors({ stack: true }),
                    timestamp({
                        format: () => dateFnsFormat(new Date(), 'yyyy-MM-dd HH:mm:ss.SSS'),
                    }),
                    logFormat
                ),
                transports: [
                    new transports.Console({
                        format: combine(logFormat),
                    }),
                    fileRotateTransport,
                    new transports.File({
                        filename: path.join(AppLogger.logDir, 'error.log'),
                        level: 'error',
                        format: combine(errors({ stack: true }), timestamp(), logFormat),
                    }),
                ],
                exitOnError: false,
                exceptionHandlers: [
                    new transports.File({
                        filename: path.join(AppLogger.logDir, 'exceptions.log'),
                    }),
                ],
                rejectionHandlers: [
                    new transports.File({
                        filename: path.join(AppLogger.logDir, 'rejections.log'),
                    }),
                ],
            });

            // Handle uncaught rejections
            process.on('unhandledRejection', reason => {
                AppLogger.instance.error(
                    'Unhandled Rejection:',
                    reason instanceof Error ? reason.stack : String(reason)
                );
            });
        }

        return AppLogger.instance;
    }

    public static getLogger(): ReturnType<typeof createLogger> {
        return AppLogger.initialize();
    }

    public static info(message: string, meta?: any): void {
        AppLogger.initialize().info(message, meta);
    }

    public static warn(message: string, meta?: any): void {
        AppLogger.initialize().warn(message, meta);
    }

    public static error(message: string | Error, meta?: any): void {
        if (message instanceof Error) {
            AppLogger.initialize().error(message.stack || message.message, {
                ...meta,
                error: message,
            });
        } else {
            AppLogger.initialize().error(message, meta);
        }
    }

    public static debug(message: string, meta?: any): void {
        AppLogger.initialize().debug(message, meta);
    }

    public static verbose(message: string, meta?: any): void {
        AppLogger.initialize().verbose(message, meta);
    }

    public static log(level: string, message: string, meta?: any): void {
        AppLogger.initialize().log(level, message, meta);
    }
}

// Initialize logger on import
AppLogger.getLogger();
