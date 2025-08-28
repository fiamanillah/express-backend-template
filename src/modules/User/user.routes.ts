// src/modules/User/user.routes.ts
import { Router } from 'express';
import { UserController } from './user.controller';
import { validateRequest } from '@/middleware/validation';
import { asyncHandler } from '@/middleware/asyncHandler';
import { UserValidation } from './user.validation';

export class UserRoutes {
    private router: Router;
    private userController: UserController;

    constructor(userController: UserController) {
        this.router = Router();
        this.userController = userController;
        this.initializeRoutes();
    }

    private initializeRoutes(): void {
        // Search users (must be before /:id routes to avoid conflicts)
        this.router.get(
            '/search',
            validateRequest({
                query: UserValidation.query.list
                    .pick({
                        search: true,
                    })
                    .extend({
                        q: UserValidation.query.list.shape.search.optional(), // Allow 'q' as alias for search
                        limit: UserValidation.query.list.shape.limit,
                    }),
            }),
            asyncHandler(this.userController.searchUsers)
        );

        // Get all users with filtering and pagination
        this.router.get(
            '/',
            validateRequest({
                query: UserValidation.query.list,
            }),
            asyncHandler(this.userController.getUsers)
        );

        // Get user by ID
        this.router.get(
            '/:id',
            validateRequest({
                params: UserValidation.params.id,
            }),
            asyncHandler(this.userController.getUserById)
        );

        // Get user statistics
        this.router.get(
            '/:id/stats',
            validateRequest({
                params: UserValidation.params.id,
            }),
            asyncHandler(this.userController.getUserStats)
        );

        // Create new user
        this.router.post(
            '/',
            validateRequest({
                body: UserValidation.body.create,
            }),
            asyncHandler(this.userController.createUser)
        );

        // Update user
        this.router.put(
            '/:id',
            validateRequest({
                params: UserValidation.params.id,
                body: UserValidation.body.update,
            }),
            asyncHandler(this.userController.updateUser)
        );

        // Update user profile
        this.router.put(
            '/:id/profile',
            validateRequest({
                params: UserValidation.params.id,
                body: UserValidation.body.updateProfile,
            }),
            asyncHandler(this.userController.updateUserProfile)
        );

        // Delete user
        this.router.delete(
            '/:id',
            validateRequest({
                params: UserValidation.params.id,
            }),
            asyncHandler(this.userController.deleteUser)
        );
    }

    public getRouter(): Router {
        return this.router;
    }
}
