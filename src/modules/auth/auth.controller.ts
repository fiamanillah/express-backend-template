// src/modules/Auth/auth.controller.ts
import { Request, Response } from 'express';
import { BaseController } from '@/core/BaseController';
import { AuthService } from './auth.service';
import { HTTPStatusCode } from '@/types/HTTPStatusCode';

export class AuthController extends BaseController {
    constructor(private authService: AuthService) {
        super();
    }

    /**
     * Register a new user
     * POST /api/auth/register
     */
    public register = async (req: Request, res: Response) => {
        const body = (req as any).validatedBody || req.body;
        this.logAction('register', req, { email: body.email, role: body.role });

        const result = await this.authService.register(body);

        return this.sendCreatedResponse(res, result, 'User registered successfully');
    };

    /**
     * Login user
     * POST /api/auth/login
     */
    public login = async (req: Request, res: Response) => {
        const body = (req as any).validatedBody || req.body;
        this.logAction('login', req, { email: body.email });

        const result = await this.authService.login(body);

        // Set secure HTTP-only cookie for token (optional)
        if (process.env.NODE_ENV === 'production') {
            res.cookie('token', result.token, {
                httpOnly: true,
                secure: true,
                sameSite: 'strict',
                maxAge: 24 * 60 * 60 * 1000, // 24 hours
            });
        }

        return this.sendResponse(res, 'Login successful', HTTPStatusCode.OK, result);
    };

    /**
     * Logout user
     * POST /api/auth/logout
     */
    public logout = async (req: Request, res: Response) => {
        const userId = this.getUserId(req);
        this.logAction('logout', req, { userId });

        // Clear cookie if it exists
        if (req.cookies?.token) {
            res.clearCookie('token');
        }

        return this.sendResponse(res, 'Logout successful', HTTPStatusCode.OK);
    };

    /**
     * Get current user profile
     * GET /api/auth/profile
     */
    public getProfile = async (req: Request, res: Response) => {
        const userId = this.getUserId(req);
        if (!userId) {
            return this.sendResponse(res, 'User not authenticated', HTTPStatusCode.UNAUTHORIZED);
        }

        this.logAction('getProfile', req, { userId });

        const profile = await this.authService.getProfile(userId);

        return this.sendResponse(res, 'Profile retrieved successfully', HTTPStatusCode.OK, profile);
    };

    /**
     * Refresh authentication token
     * POST /api/auth/refresh
     */
    public refreshToken = async (req: Request, res: Response) => {
        const body = (req as any).validatedBody || req.body;
        const currentToken = body.token || req.headers.authorization?.replace('Bearer ', '');

        if (!currentToken) {
            return this.sendResponse(res, 'Token is required', HTTPStatusCode.BAD_REQUEST);
        }

        this.logAction('refreshToken', req);

        const result = await this.authService.refreshToken(currentToken);

        // Update secure HTTP-only cookie for token (optional)
        if (process.env.NODE_ENV === 'production') {
            res.cookie('token', result.token, {
                httpOnly: true,
                secure: true,
                sameSite: 'strict',
                maxAge: 24 * 60 * 60 * 1000, // 24 hours
            });
        }

        return this.sendResponse(res, 'Token refreshed successfully', HTTPStatusCode.OK, result);
    };

    /**
     * Change user password
     * POST /api/auth/change-password
     */
    public changePassword = async (req: Request, res: Response) => {
        const userId = this.getUserId(req);
        if (!userId) {
            return this.sendResponse(res, 'User not authenticated', HTTPStatusCode.UNAUTHORIZED);
        }

        const body = (req as any).validatedBody || req.body;
        this.logAction('changePassword', req, { userId });

        await this.authService.changePassword(
            parseInt(userId),
            body.currentPassword,
            body.newPassword
        );

        return this.sendResponse(res, 'Password changed successfully', HTTPStatusCode.OK);
    };

    /**
     * Update user role (admin only)
     * PUT /api/auth/users/:userId/role
     */
    public updateUserRole = async (req: Request, res: Response) => {
        const params = (req as any).validatedParams || req.params;
        const body = (req as any).validatedBody || req.body;
        const { userId } = params;
        const currentUserId = this.getUserId(req);

        this.logAction('updateUserRole', req, {
            targetUserId: userId,
            currentUserId,
            newRole: body.role,
        });

        const updatedUser = await this.authService.updateUserRole(parseInt(userId), body.role);

        return this.sendResponse(
            res,
            'User role updated successfully',
            HTTPStatusCode.OK,
            updatedUser
        );
    };

    /**
     * Verify token validity
     * POST /api/auth/verify
     */
    public verifyToken = async (req: Request, res: Response) => {
        const token = req.headers.authorization?.replace('Bearer ', '') || req.body.token;

        if (!token) {
            return this.sendResponse(res, 'Token is required', HTTPStatusCode.BAD_REQUEST);
        }

        this.logAction('verifyToken', req);

        const tokenInfo = await this.authService.verifyToken(token);

        return this.sendResponse(res, 'Token is valid', HTTPStatusCode.OK, tokenInfo);
    };

    /**
     * Get all users (admin only)
     * GET /api/auth/users
     */
    public getUsers = async (req: Request, res: Response) => {
        const pagination = this.extractPaginationParams(req);
        this.logAction('getUsers', req, { pagination });

        // This would typically use a UserService, but for demo purposes:
        const users = await this.authService['prisma'].user.findMany({
            skip: pagination.offset,
            take: pagination.limit,
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                status: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        const total = await this.authService['prisma'].user.count();
        const paginationMeta = this.calculatePagination(pagination.page, pagination.limit, total);

        return this.sendPaginatedResponse(
            res,
            paginationMeta,
            'Users retrieved successfully',
            users
        );
    };

    /**
     * Get user statistics (admin only)
     * GET /api/auth/stats
     */
    public getAuthStats = async (req: Request, res: Response) => {
        this.logAction('getAuthStats', req);

        const [totalUsers, activeUsers, adminUsers] = await Promise.all([
            this.authService['prisma'].user.count(),
            this.authService['prisma'].user.count({
                where: { status: 'active' },
            }),
            this.authService['prisma'].user.count({
                where: { role: 'admin' },
            }),
        ]);

        const stats = {
            totalUsers,
            activeUsers,
            adminUsers,
            usersByRole: await this.authService['prisma'].user.groupBy({
                by: ['role'],
                _count: true,
            }),
            recentRegistrations: await this.authService['prisma'].user.count({
                where: {
                    createdAt: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
                    },
                },
            }),
        };

        return this.sendResponse(
            res,
            'Authentication statistics retrieved successfully',
            HTTPStatusCode.OK,
            stats
        );
    };
}
