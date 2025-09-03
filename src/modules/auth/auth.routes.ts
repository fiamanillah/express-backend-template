// src/modules/Auth/auth.routes.ts
import { Router, Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { validateRequest } from '@/middleware/validation';
import { asyncHandler } from '@/middleware/asyncHandler';
import { authenticate, authorize } from '@/middleware/auth';
import { AuthValidation } from './auth.validation';

export class AuthRoutes {
    private router: Router;
    private authController: AuthController;

    constructor(authController: AuthController) {
        this.router = Router();
        this.authController = authController;
        this.initializeRoutes();
    }

    private initializeRoutes(): void {
        // Public routes (no authentication required)

        // Register new user
        this.router.post(
            '/register',
            validateRequest({
                body: AuthValidation.register,
            }),
            asyncHandler((req: Request, res: Response) => this.authController.register(req, res))
        );

        // Login user
        this.router.post(
            '/login',
            validateRequest({
                body: AuthValidation.login,
            }),
            asyncHandler((req: Request, res: Response) => this.authController.login(req, res))
        );

        // Verify token (useful for client-side token validation)
        this.router.post(
            '/verify',
            asyncHandler((req: Request, res: Response) => this.authController.verifyToken(req, res))
        );

        // Refresh token
        this.router.post(
            '/refresh',
            validateRequest({
                body: AuthValidation.refreshToken,
            }),
            asyncHandler((req: Request, res: Response) =>
                this.authController.refreshToken(req, res)
            )
        );

        // Protected routes (authentication required)

        // Get current user profile
        this.router.get(
            '/profile',
            authenticate,
            asyncHandler((req: Request, res: Response) => this.authController.getProfile(req, res))
        );

        // Logout user
        this.router.post(
            '/logout',
            authenticate,
            asyncHandler((req: Request, res: Response) => this.authController.logout(req, res))
        );

        // Change password
        this.router.post(
            '/change-password',
            authenticate,
            validateRequest({
                body: AuthValidation.changePassword,
            }),
            asyncHandler((req: Request, res: Response) =>
                this.authController.changePassword(req, res)
            )
        );

        // Admin only routes

        // Get all users (admin only)
        this.router.get(
            '/users',
            authenticate,
            authorize('admin'),
            asyncHandler((req: Request, res: Response) => this.authController.getUsers(req, res))
        );

        // Update user role (admin only)
        this.router.put(
            '/users/:userId/role',
            authenticate,
            authorize('admin'),
            validateRequest({
                params: AuthValidation.params.userId,
                body: AuthValidation.updateRole,
            }),
            asyncHandler((req: Request, res: Response) =>
                this.authController.updateUserRole(req, res)
            )
        );

        // Get authentication statistics (admin only)
        this.router.get(
            '/stats',
            authenticate,
            authorize('admin'),
            asyncHandler((req: Request, res: Response) =>
                this.authController.getAuthStats(req, res)
            )
        );
    }

    public getRouter(): Router {
        return this.router;
    }
}
