// src/core/BaseService.ts
import { PrismaClient } from '@prisma/client';
import { AppLogger } from './logging/logger';
import { DatabaseError, NotFoundError } from './errors/AppError';

export interface BaseServiceOptions {
    enableSoftDelete?: boolean;
    enableAuditFields?: boolean;
}

export interface PaginationOptions {
    page: number;
    limit: number;
    offset: number;
}

export interface PaginationResult<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
}

// Type for Prisma transaction callback
type TransactionCallback<T> = (
    tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>
) => Promise<T>;

export abstract class BaseService<TModel = any, TCreateInput = any, TUpdateInput = any> {
    protected prisma: PrismaClient;
    protected modelName: string;
    protected options: BaseServiceOptions;

    constructor(prisma: PrismaClient, modelName: string, options: BaseServiceOptions = {}) {
        this.prisma = prisma;
        this.modelName = modelName;
        this.options = {
            enableSoftDelete: false,
            enableAuditFields: false,
            ...options,
        };
    }

    /**
     * Get the Prisma model delegate
     * Override this method to return the appropriate model
     */
    protected abstract getModel(): any;

    /**
     * Find many records with optional filters and pagination
     */
    protected async findMany(
        filters: any = {},
        pagination?: PaginationOptions,
        include?: any,
        orderBy?: any,
        omit?: any
    ): Promise<TModel[] | PaginationResult<TModel>> {
        try {
            const where = this.buildWhereClause(filters);

            if (pagination) {
                const [data, total] = await Promise.all([
                    this.getModel().findMany({
                        where,
                        include,
                        orderBy,
                        skip: pagination.offset,
                        take: pagination.limit,
                        omit,
                    }),
                    this.getModel().count({ where }),
                ]);

                const totalPages = Math.ceil(total / pagination.limit);

                return {
                    data: data as TModel[],
                    total,
                    page: pagination.page,
                    limit: pagination.limit,
                    totalPages,
                    hasNext: pagination.page < totalPages,
                    hasPrevious: pagination.page > 1,
                };
            }

            const result = await this.getModel().findMany({
                where,
                include,
                orderBy,
                omit,
            });

            return result as TModel[];
        } catch (error) {
            return this.handleDatabaseError(error, 'findMany');
        }
    }

    /**
     * Find a single record by ID
     */
    protected async findById(id: string | number, include?: any): Promise<TModel | null> {
        try {
            const where = this.buildWhereClause({ id });

            const result = await this.getModel().findFirst({
                where,
                include,
            });

            return result as TModel | null;
        } catch (error) {
            return this.handleDatabaseError(error, 'findById');
        }
    }

    /**
     * Find a single record by filters
     */
    protected async findOne(filters: any, include?: any, omit?: any): Promise<TModel | null> {
        try {
            const where = this.buildWhereClause(filters);

            const result = await this.getModel().findFirst({
                where,
                include,
                omit,
            });

            return result as TModel | null;
        } catch (error) {
            return this.handleDatabaseError(error, 'findOne');
        }
    }

    /**
     * Create a new record
     */
    protected async create(data: TCreateInput, include?: any): Promise<TModel> {
        try {
            const createData = this.prepareCreateData(data);

            const result = await this.getModel().create({
                data: createData,
                include,
            });

            return result as TModel;
        } catch (error) {
            return this.handleDatabaseError(error, 'create');
        }
    }

    /**
     * Update a record by ID
     */
    protected async updateById(
        id: string | number,
        data: TUpdateInput,
        include?: any
    ): Promise<TModel> {
        try {
            const updateData = this.prepareUpdateData(data);

            const result = await this.getModel().update({
                where: { id },
                data: updateData,
                include,
            });

            return result as TModel;
        } catch (error) {
            return this.handleDatabaseError(error, 'updateById');
        }
    }

    /**
     * Delete a record by ID (soft delete if enabled)
     */
    protected async deleteById(id: string | number): Promise<TModel> {
        try {
            if (this.options.enableSoftDelete) {
                return await this.softDelete(id);
            }

            const result = await this.getModel().delete({
                where: { id },
            });

            return result as TModel;
        } catch (error) {
            return this.handleDatabaseError(error, 'deleteById');
        }
    }

    /**
     * Soft delete a record
     */
    protected async softDelete(id: string | number): Promise<TModel> {
        try {
            const result = await this.getModel().update({
                where: { id },
                data: {
                    deletedAt: new Date(),
                },
            });

            return result as TModel;
        } catch (error) {
            return this.handleDatabaseError(error, 'softDelete');
        }
    }

    /**
     * Check if a record exists
     */
    protected async exists(filters: any): Promise<boolean> {
        try {
            const where = this.buildWhereClause(filters);
            const count = await this.getModel().count({ where });
            return count > 0;
        } catch (error) {
            return this.handleDatabaseError(error, 'exists');
        }
    }

    /**
     * Count records with optional filters
     */
    protected async count(filters: any = {}): Promise<number> {
        try {
            const where = this.buildWhereClause(filters);
            return await this.getModel().count({ where });
        } catch (error) {
            return this.handleDatabaseError(error, 'count');
        }
    }

    /**
     * Build where clause with soft delete consideration
     */
    private buildWhereClause(filters: any): any {
        if (this.options.enableSoftDelete) {
            return {
                ...filters,
                deletedAt: null,
            };
        }
        return filters;
    }

    /**
     * Prepare data for create operation
     */
    private prepareCreateData(data: TCreateInput): any {
        if (this.options.enableAuditFields) {
            return {
                ...data,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
        }
        return data;
    }

    /**
     * Prepare data for update operation
     */
    private prepareUpdateData(data: TUpdateInput): any {
        if (this.options.enableAuditFields) {
            return {
                ...data,
                updatedAt: new Date(),
            };
        }
        return data;
    }

    /**
     * Handle database errors and convert to appropriate AppError
     */
    private handleDatabaseError(error: any, operation: string): never {
        AppLogger.error(`Database error in ${this.modelName}.${operation}`, {
            error: error instanceof Error ? error.message : String(error),
            operation,
            modelName: this.modelName,
        });

        if (error.code === 'P2025') {
            throw new NotFoundError(`${this.modelName} not found`);
        }

        throw new DatabaseError(`Failed to ${operation} ${this.modelName.toLowerCase()}`, {
            originalError: error.message,
            code: error.code,
        });
    }

    /**
     * Execute a database transaction
     */
    protected async transaction<T>(callback: TransactionCallback<T>): Promise<T> {
        try {
            return await this.prisma.$transaction(callback);
        } catch (error) {
            return this.handleDatabaseError(error, 'transaction');
        }
    }
}
