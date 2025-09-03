// src/modules/User/user.service.ts
import { PrismaClient, User, Profile } from '@prisma/client';
import { BaseService } from '@/core/BaseService';
import { AppLogger } from '@/core/logging/logger';
import { ConflictError, NotFoundError } from '@/core/errors/AppError';
import {
    CreateUserInput,
    UpdateUserInput,
    UpdateUserProfileInput,
    UserListQuery,
} from './user.validation';

export interface UserWithProfile extends User {
    profile: Profile | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface UserFilters {
    search?: string;
    email?: string;
}

export class UserService extends BaseService<User, CreateUserInput, UpdateUserInput> {
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
     * Get all users with optional filtering and pagination
     */
    async getUsers(query: UserListQuery) {
        const { page, limit, search, email, sortBy = 'createdAt', sortOrder = 'desc' } = query;
        const offset = (page - 1) * limit;

        // Build filters
        const filters: any = {};

        if (search) {
            filters.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (email) {
            filters.email = { contains: email, mode: 'insensitive' };
        }

        // Build orderBy
        const orderBy: any = {};
        orderBy[sortBy] = sortOrder;

        const result = await this.findMany(
            filters,
            { page, limit, offset },
            { profile: true }, // Include profile
            orderBy
        );

        AppLogger.info('Users retrieved successfully', {
            filters,
            pagination: { page, limit },
            totalCount: typeof result === 'object' && 'total' in result ? result.total : 'N/A',
        });

        return result;
    }

    /**
     * Get a single user by ID
     */
    async getUserById(id: number): Promise<UserWithProfile> {
        const user = await this.findById(id, { profile: true });

        if (!user) {
            throw new NotFoundError('User');
        }

        AppLogger.info(`User retrieved successfully`, { userId: id });
        return user as UserWithProfile;
    }

    /**
     * Get a user by email
     */
    async getUserByEmail(email: string): Promise<UserWithProfile | null> {
        const user = await this.findOne({ email }, { profile: true });

        if (user) {
            AppLogger.info(`User found by email`, { email });
        }

        return user as UserWithProfile | null;
    }

    /**
     * Create a new user
     */
    async createUser(data: CreateUserInput): Promise<UserWithProfile> {
        // Check if user already exists
        const existingUser = await this.getUserByEmail(data.email);
        if (existingUser) {
            throw new ConflictError('User with this email already exists');
        }

        // Use transaction to create user with profile if provided
        const user = await this.transaction(async tx => {
            // Create user
            const newUser = await tx.user.create({
                data: {
                    email: data.email,
                    name: data.name,
                },
                include: { profile: true },
            });

            // Create profile if provided
            if (data.profile) {
                await tx.profile.create({
                    data: {
                        userId: newUser.id,
                        bio: data.profile.bio,
                    },
                });

                // Fetch user with profile
                return tx.user.findUnique({
                    where: { id: newUser.id },
                    include: { profile: true },
                });
            }

            return newUser;
        });

        AppLogger.info('User created successfully', {
            userId: user!.id,
            email: data.email,
        });

        return user as UserWithProfile;
    }

    /**
     * Update a user
     */
    async updateUser(id: number, data: UpdateUserInput): Promise<UserWithProfile> {
        // Check if user exists
        await this.getUserById(id);

        // Check email uniqueness if email is being updated
        if (data.email) {
            const existingUser = await this.getUserByEmail(data.email);
            if (existingUser && existingUser.id !== id) {
                throw new ConflictError('Another user with this email already exists');
            }
        }

        const updatedUser = await this.updateById(id, data, { profile: true });

        AppLogger.info('User updated successfully', {
            userId: id,
            updatedFields: Object.keys(data),
        });

        return updatedUser as UserWithProfile;
    }

    /**
     * Update user profile
     */
    async updateUserProfile(userId: number, data: UpdateUserProfileInput): Promise<Profile> {
        // Check if user exists
        await this.getUserById(userId);

        // Check if profile exists
        const existingProfile = await this.prisma.profile.findUnique({
            where: { userId },
        });

        let profile: Profile;

        if (existingProfile) {
            // Update existing profile
            profile = await this.prisma.profile.update({
                where: { userId },
                data,
            });
        } else {
            // Create new profile
            profile = await this.prisma.profile.create({
                data: {
                    userId,
                    ...data,
                },
            });
        }

        AppLogger.info('User profile updated successfully', {
            userId,
            updatedFields: Object.keys(data),
        });

        return profile;
    }

    /**
     * Delete a user
     */
    async deleteUser(id: number): Promise<void> {
        // Check if user exists
        await this.getUserById(id);

        // Use transaction to delete user and related data
        await this.transaction(async tx => {
            // Delete profile first (due to foreign key constraint)
            await tx.profile.deleteMany({
                where: { userId: id },
            });

            // Delete posts
            await tx.post.deleteMany({
                where: { authorId: id },
            });

            // Delete user
            await tx.user.delete({
                where: { id },
            });
        });

        AppLogger.info('User deleted successfully', { userId: id });
    }

    /**
     * Check if user exists
     */
    async userExists(id: number): Promise<boolean> {
        return await this.exists({ id });
    }

    /**
     * Get user statistics
     */
    async getUserStats(id: number) {
        const user = await this.getUserById(id);

        const [postCount] = await Promise.all([
            this.prisma.post.count({
                where: { authorId: id },
            }),
        ]);

        return {
            user,
            stats: {
                totalPosts: postCount,
                joinedAt: user.createdAt,
            },
        };
    }

    /**
     * Search users by name or email
     */
    async searchUsers(searchTerm: string, limit: number = 10): Promise<UserWithProfile[]> {
        const users = await this.getModel().findMany({
            where: {
                OR: [
                    { name: { contains: searchTerm, mode: 'insensitive' } },
                    { email: { contains: searchTerm, mode: 'insensitive' } },
                ],
            },
            include: { profile: true },
            take: limit,
            orderBy: { id: 'desc' }, // Changed from createdAt to id
        });

        AppLogger.info('Users searched successfully', {
            searchTerm,
            resultCount: users.length,
        });

        return users as UserWithProfile[];
    }

    async count() {
        return await this.getModel().count();
    }
}
