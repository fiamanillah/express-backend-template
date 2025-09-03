// src/modules/Auth/auth.service.ts
import { PrismaClient, User } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { BaseService } from '@/core/BaseService';
import { AppLogger } from '@/core/logging/logger';
import { AuthenticationError, ConflictError, NotFoundError } from '@/core/errors/AppError';
import { config } from '@/core/config';
import { JWTPayload } from '@/middleware/auth';

export interface LoginInput {
    email: string;
    password: string;
}

export interface RegisterInput {
    email: string;
    password: string;
    name?: string;
    role?: string;
}

export interface AuthResponse {
    user: Omit<User, 'password'>;
    token: string;
    expiresIn: string;
}

export interface TokenInfo {
    userId: string;
    email: string;
    role: string;
}

export class AuthService extends BaseService<User> {
    private readonly SALT_ROUNDS = 12;

    constructor(prisma: PrismaClient) {
        super(prisma, 'User', {
            enableSoftDelete: false,
            enableAuditFields: true,
        });
    }

    protected getModel() {
        return this.prisma.user;
    }

    /**
     * Register a new user
     */
    async register(data: RegisterInput): Promise<AuthResponse> {
        const { email, password, name, role = 'user' } = data;

        // Check if user already exists
        const existingUser = await this.findOne({ email });
        if (existingUser) {
            throw new ConflictError('User with this email already exists');
        }

        // Validate role
        const validRoles = ['user', 'admin', 'moderator'];
        if (!validRoles.includes(role)) {
            throw new AuthenticationError('Invalid role provided');
        }

        // Hash password
        const hashedPassword = await this.hashPassword(password);

        // Create user
        const user = await this.create({
            email,
            password: hashedPassword,
            name,
            role,
        });

        AppLogger.info('User registered successfully', {
            userId: user.id,
            email: user.email,
            role: user.role,
        });

        // Generate token and return response
        return this.generateAuthResponse(user);
    }

    /**
     * Login user
     */
    async login(data: LoginInput): Promise<AuthResponse> {
        const { email, password } = data;

        // Find user by email
        const user = await this.findOne({ email });
        if (!user) {
            throw new AuthenticationError('Invalid email or password');
        }

        // Check if user is active (if you have user status)
        if (user.status && user.status !== 'active') {
            throw new AuthenticationError('Account is not active');
        }

        // Verify password
        const isValidPassword = await this.verifyPassword(password, user.password);
        if (!isValidPassword) {
            AppLogger.warn('Failed login attempt', { email, userId: user.id });
            throw new AuthenticationError('Invalid email or password');
        }

        AppLogger.info('User logged in successfully', {
            userId: user.id,
            email: user.email,
            role: user.role,
        });

        return this.generateAuthResponse(user);
    }

    /**
     * Refresh token
     */
    async refreshToken(currentToken: string): Promise<AuthResponse> {
        try {
            if (!config.security.jwt.secret) {
                throw new AuthenticationError('JWT configuration missing');
            }

            // Verify current token
            const decoded = jwt.verify(currentToken, config.security.jwt.secret) as JWTPayload;

            // Get fresh user data
            const user = await this.findById(parseInt(decoded.id));
            if (!user) {
                throw new NotFoundError('User not found');
            }

            // Check if user is still active
            if (user.status && user.status !== 'active') {
                throw new AuthenticationError('Account is not active');
            }

            AppLogger.info('Token refreshed successfully', {
                userId: user.id,
                email: user.email,
            });

            return this.generateAuthResponse(user);
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                throw new AuthenticationError('Token expired');
            }
            if (error instanceof jwt.JsonWebTokenError) {
                throw new AuthenticationError('Invalid token');
            }
            throw error;
        }
    }

    /**
     * Change user password
     */
    async changePassword(
        userId: number,
        currentPassword: string,
        newPassword: string
    ): Promise<void> {
        const user = await this.findById(userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }

        // Verify current password
        const isValidPassword = await this.verifyPassword(currentPassword, user.password);
        if (!isValidPassword) {
            throw new AuthenticationError('Current password is incorrect');
        }

        // Hash new password
        const hashedNewPassword = await this.hashPassword(newPassword);

        // Update password
        await this.updateById(userId, { password: hashedNewPassword });

        AppLogger.info('Password changed successfully', { userId });
    }

    /**
     * Get user profile by token
     */
    async getProfile(userId: string): Promise<Omit<User, 'password'>> {
        const user = await this.findById(parseInt(userId), { profile: true });
        if (!user) {
            throw new NotFoundError('User not found');
        }

        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }

    /**
     * Update user role (admin only)
     */
    async updateUserRole(userId: number, newRole: string): Promise<Omit<User, 'password'>> {
        const validRoles = ['user', 'admin', 'moderator'];
        if (!validRoles.includes(newRole)) {
            throw new AuthenticationError('Invalid role provided');
        }

        const user = await this.findById(userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }

        const updatedUser = await this.updateById(userId, { role: newRole });

        AppLogger.info('User role updated', {
            userId,
            oldRole: user.role,
            newRole,
        });

        // Remove password from response
        const { password, ...userWithoutPassword } = updatedUser;
        return userWithoutPassword;
    }

    /**
     * Verify JWT token and return user info
     */
    async verifyToken(token: string): Promise<TokenInfo> {
        try {
            if (!config.security.jwt.secret) {
                throw new AuthenticationError('JWT configuration missing');
            }

            const decoded = jwt.verify(token, config.security.jwt.secret) as JWTPayload;

            // Optionally verify user still exists and is active
            const user = await this.findById(parseInt(decoded.id));
            if (!user) {
                throw new AuthenticationError('User not found');
            }

            if (user.status && user.status !== 'active') {
                throw new AuthenticationError('Account is not active');
            }

            return {
                userId: decoded.id,
                email: decoded.email,
                role: decoded.role,
            };
        } catch (error) {
            if (error instanceof jwt.JsonWebTokenError) {
                throw new AuthenticationError('Invalid token');
            }
            if (error instanceof jwt.TokenExpiredError) {
                throw new AuthenticationError('Token expired');
            }
            throw error;
        }
    }

    /**
     * Generate authentication response with token
     */
    private generateAuthResponse(user: User): AuthResponse {
        if (!config.security.jwt.secret) {
            throw new AuthenticationError('JWT configuration missing');
        }

        const payload: JWTPayload = {
            id: user.id.toString(),
            email: user.email,
            role: user.role,
        };

        const token = jwt.sign(payload, config.security.jwt.secret, {
            expiresIn: '1d',
        });

        // Remove password from user object
        const { password, ...userWithoutPassword } = user;

        return {
            user: userWithoutPassword,
            token,
            expiresIn: config.security.jwt.expiresIn,
        };
    }

    /**
     * Hash password using bcrypt
     */
    private async hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, this.SALT_ROUNDS);
    }

    /**
     * Verify password using bcrypt
     */
    private async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
        return bcrypt.compare(plainPassword, hashedPassword);
    }
}
