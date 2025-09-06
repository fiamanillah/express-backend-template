// src/modules/User/user.controller.ts
import { Request, Response } from 'express';
import { BaseController } from '@/core/BaseController';
import { UserService } from './user.service';
import { AppLogger } from '@/core/logging/logger';
import { NotFoundError } from '@/core/errors/AppError';
import { HTTPStatusCode } from '@/types/HTTPStatusCode';

export class UserController extends BaseController {
    constructor(private userService: UserService) {
        super();
    }

    /**
     * Get all users with optional filtering and pagination
     * GET /api/users
     */
    public getUsers = async (req: Request, res: Response) => {
        // Use validated query if available, fallback to req.query
        const query = req.validatedQuery || req.query;
        this.logAction('getUsers', req, { query });

        const result = await this.userService.getUsers(query);

        if (typeof result === 'object' && 'data' in result) {
            // Paginated response
            return this.sendPaginatedResponse(
                res,
                {
                    page: result.page,
                    limit: result.limit,
                    total: result.total,
                    totalPages: result.totalPages,
                    hasNext: result.hasNext,
                    hasPrevious: result.hasPrevious,
                },
                'Users retrieved successfully',
                result.data
            );
        } else {
            // Non-paginated response
            return this.sendResponse(
                res,
                'Users retrieved successfully',
                HTTPStatusCode.OK,
                result
            );
        }
    };

    /**
     * Get a single user by ID
     * GET /api/users/:id
     */
    public getUserById = async (req: Request, res: Response) => {
        const params = req.validatedParams || req.params;
        const { id } = params;
        const userId = parseInt(id);

        this.logAction('getUserById', req, { userId });

        const user = await this.userService.getUserById(userId);
        return this.sendResponse(res, 'User retrieved successfully', HTTPStatusCode.OK, user);
    };

    /**
     * Create a new user
     * POST /api/users
     */
    // public createUser = async (req: Request, res: Response) => {
    //     const body = req.validatedBody || req.body;
    //     this.logAction('createUser', req, { email: body.email });

    //     const user = await this.userService.createUser(body);
    //     return this.sendCreatedResponse(res, user, 'User created successfully');
    // };

    /**
     * Update a user
     * PUT /api/users/:id
     */
    public updateUser = async (req: Request, res: Response) => {
        const params = req.validatedParams || req.params;
        const body = req.validatedBody || req.body;
        const { id } = params;
        const userId = parseInt(id);

        this.logAction('updateUser', req, { userId, updatedFields: Object.keys(body) });

        const user = await this.userService.updateUser(userId, body);
        return this.sendResponse(res, 'User updated successfully', HTTPStatusCode.OK, user);
    };

    /**
     * Update user profile
     * PUT /api/users/:id/profile
     */
    public updateUserProfile = async (req: Request, res: Response) => {
        const params = req.validatedParams || req.params;
        const body = req.validatedBody || req.body;
        const { id } = params;
        const userId = parseInt(id);

        this.logAction('updateUserProfile', req, { userId });

        const profile = await this.userService.updateUserProfile(userId, body);
        return this.sendResponse(
            res,
            'User profile updated successfully',
            HTTPStatusCode.OK,
            profile
        );
    };

    /**
     * Delete a user
     * DELETE /api/users/:id
     */
    public deleteUser = async (req: Request, res: Response) => {
        const params = req.validatedParams || req.params;
        const { id } = params;
        const userId = parseInt(id);

        this.logAction('deleteUser', req, { userId });

        await this.userService.deleteUser(userId);
        return this.sendNoContentResponse(res);
    };

    /**
     * Get user statistics
     * GET /api/users/:id/stats
     */
    public getUserStats = async (req: Request, res: Response) => {
        const params = req.validatedParams || req.params;
        const { id } = params;
        const userId = parseInt(id);

        this.logAction('getUserStats', req, { userId });

        const stats = await this.userService.getUserStats(userId);
        return this.sendResponse(
            res,
            'User statistics retrieved successfully',
            HTTPStatusCode.OK,
            stats
        );
    };

    /**
     * Search users
     * GET /api/users/search
     */
    public searchUsers = async (req: Request, res: Response) => {
        const query = req.validatedQuery || req.query;
        const { q: searchTerm, search, limit = '10' } = query;

        // Support both 'q' and 'search' parameters
        const finalSearchTerm = searchTerm || search;

        if (!finalSearchTerm || typeof finalSearchTerm !== 'string') {
            throw new NotFoundError('Search term is required');
        }

        this.logAction('searchUsers', req, { searchTerm: finalSearchTerm, limit });

        const users = await this.userService.searchUsers(
            finalSearchTerm,
            parseInt(limit as string)
        );
        return this.sendResponse(res, 'Users searched successfully', HTTPStatusCode.OK, users);
    };
}
