// src/modules/User/user.controller.ts
import { Request, Response } from 'express';
import { BaseController } from '@/core/BaseController';
import { UserService } from './user.service';
import { AppLogger } from '@/core/logging/logger';
import { NotFoundError } from '@/core/errors/AppError';
import {
    CreateUserInput,
    UpdateUserInput,
    UpdateUserProfileInput,
    UserListQuery,
    UserIdParams,
} from './user.validation';

export class UserController extends BaseController {
    constructor(private userService: UserService) {
        super();
    }

    /**
     * Get all users with optional filtering and pagination
     * GET /api/users
     */
    public getUsers = async (req: Request<{}, {}, {}, UserListQuery>, res: Response) => {
        this.logAction('getUsers', req as any, { query: req.query });

        const result = await this.userService.getUsers(req.query);

        if (typeof result === 'object' && 'data' in result) {
            // Paginated response
            return this.sendPaginatedResponse(
                res,
                result.data,
                {
                    page: result.page,
                    limit: result.limit,
                    total: result.total,
                    totalPages: result.totalPages,
                    hasNext: result.hasNext,
                    hasPrevious: result.hasPrevious,
                },
                'Users retrieved successfully'
            );
        } else {
            // Non-paginated response
            return this.sendResponse(res, result, 'Users retrieved successfully');
        }
    };

    /**
     * Get a single user by ID
     * GET /api/users/:id
     */
    public getUserById = async (req: Request<UserIdParams>, res: Response) => {
        const { id } = req.params;
        const userId = parseInt(id);

        this.logAction('getUserById', req, { userId });

        const user = await this.userService.getUserById(userId);
        return this.sendResponse(res, user, 'User retrieved successfully');
    };

    /**
     * Create a new user
     * POST /api/users
     */
    public createUser = async (req: Request<{}, {}, CreateUserInput>, res: Response) => {
        this.logAction('createUser', req, { email: req.body.email });

        const user = await this.userService.createUser(req.body);
        return this.sendCreatedResponse(res, user, 'User created successfully');
    };

    /**
     * Update a user
     * PUT /api/users/:id
     */
    public updateUser = async (req: Request<UserIdParams, {}, UpdateUserInput>, res: Response) => {
        const { id } = req.params;
        const userId = parseInt(id);

        this.logAction('updateUser', req, { userId, updatedFields: Object.keys(req.body) });

        const user = await this.userService.updateUser(userId, req.body);
        return this.sendResponse(res, user, 'User updated successfully');
    };

    /**
     * Update user profile
     * PUT /api/users/:id/profile
     */
    public updateUserProfile = async (
        req: Request<UserIdParams, {}, UpdateUserProfileInput>,
        res: Response
    ) => {
        const { id } = req.params;
        const userId = parseInt(id);

        this.logAction('updateUserProfile', req, { userId });

        const profile = await this.userService.updateUserProfile(userId, req.body);
        return this.sendResponse(res, profile, 'User profile updated successfully');
    };

    /**
     * Delete a user
     * DELETE /api/users/:id
     */
    public deleteUser = async (req: Request<UserIdParams>, res: Response) => {
        const { id } = req.params;
        const userId = parseInt(id);

        this.logAction('deleteUser', req, { userId });

        await this.userService.deleteUser(userId);
        return this.sendNoContentResponse(res);
    };

    /**
     * Get user statistics
     * GET /api/users/:id/stats
     */
    public getUserStats = async (req: Request<UserIdParams>, res: Response) => {
        const { id } = req.params;
        const userId = parseInt(id);

        this.logAction('getUserStats', req, { userId });

        const stats = await this.userService.getUserStats(userId);
        return this.sendResponse(res, stats, 'User statistics retrieved successfully');
    };

    /**
     * Search users
     * GET /api/users/search
     */
    public searchUsers = async (req: Request, res: Response) => {
        const { q: searchTerm, limit = '10' } = req.query;

        if (!searchTerm || typeof searchTerm !== 'string') {
            throw new NotFoundError('Search term is required');
        }

        this.logAction('searchUsers', req, { searchTerm, limit });

        const users = await this.userService.searchUsers(searchTerm, parseInt(limit as string));
        return this.sendResponse(res, users, 'Users searched successfully');
    };
}
