// src/modules/User/user.routes.ts
import { Router, Request, Response } from 'express';
import { UserController } from './user.controller';
import { validateRequest } from '@/middleware/validation';
import { asyncHandler } from '@/middleware/asyncHandler';
import { UserValidation } from './user.validation';
import { authenticate, authorizeOwnerOrAdmin } from '@/middleware/auth';

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
                query: UserValidation.query.search,
            }),
            asyncHandler((req: Request, res: Response) => this.userController.searchUsers(req, res))
        );

        // Get all users with filtering and pagination
        this.router.get(
            '/',
            validateRequest({
                query: UserValidation.query.list,
            }),
            asyncHandler((req: Request, res: Response) => this.userController.getUsers(req, res))
        );

        // Get user by ID
        this.router.get(
            '/:id',
            authenticate,
            authorizeOwnerOrAdmin('id'),
            validateRequest({
                params: UserValidation.params.id,
            }),
            asyncHandler((req: Request, res: Response) => this.userController.getUserById(req, res))
        );

        // Get user statistics
        this.router.get(
            '/:id/stats',
            validateRequest({
                params: UserValidation.params.id,
            }),
            asyncHandler((req: Request, res: Response) =>
                this.userController.getUserStats(req, res)
            )
        );

        // Create new user
        // this.router.post(
        //     '/',
        //     validateRequest({
        //         body: UserValidation.body.create,
        //     }),
        //     asyncHandler((req: Request, res: Response) => this.userController.createUser(req, res))
        // );

        // Update user
        this.router.put(
            '/:id',
            validateRequest({
                params: UserValidation.params.id,
                body: UserValidation.body.update,
            }),
            asyncHandler((req: Request, res: Response) => this.userController.updateUser(req, res))
        );

        // Update user profile
        this.router.put(
            '/:id/profile',
            validateRequest({
                params: UserValidation.params.id,
                body: UserValidation.body.updateProfile,
            }),
            asyncHandler((req: Request, res: Response) =>
                this.userController.updateUserProfile(req, res)
            )
        );

        // Delete user
        this.router.delete(
            '/:id',
            validateRequest({
                params: UserValidation.params.id,
            }),
            asyncHandler((req: Request, res: Response) => this.userController.deleteUser(req, res))
        );
    }

    public getRouter(): Router {
        return this.router;
    }
}
