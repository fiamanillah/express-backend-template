// Define a proper type for logger metadata
export interface LogMeta {
    // Common properties you might want to log
    requestId?: string;
    userId?: string;
    module?: string;
    method?: string;
    path?: string;
    statusCode?: number;
    duration?: number;
    error?: Error;
    stack?: string;
    // Allow additional properties but with type safety
    [key: string]: unknown;
}

// More specific types for different contexts
export interface RequestLogMeta extends LogMeta {
    ip?: string;
    userAgent?: string;
    params?: Record<string, unknown>;
    query?: Record<string, unknown>;
    body?: unknown;
}

export interface ErrorLogMeta extends LogMeta {
    error: Error;
    code?: string;
    details?: unknown;
}
