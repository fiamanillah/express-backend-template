export interface ApiResponse<T = any> {
    success: boolean;
    message?: string;
    meta?: {
        requestId: string;
        timestamp: string;
        [key: string]: any;
    };
    data?: T;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
    meta: ApiResponse['meta'] & {
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
            hasNext: boolean;
            hasPrevious: boolean;
        };
    };
}
