// src/modules/User/user.validation.ts
import { z } from 'zod';

// Helper to transform string numbers safely
const stringToNumber = (val: unknown) => {
    if (typeof val === 'string') {
        const num = parseInt(val);
        return isNaN(num) ? undefined : num;
    }
    if (typeof val === 'number') {
        return val;
    }
    return undefined;
};

// Common validation schemas
export const UserValidation = {
    // ID parameter validation
    params: {
        id: z.object({
            id: z.string().min(1, 'User ID is required').regex(/^\d+$/, 'User ID must be a number'),
        }),
    },

    // Query parameter validation for listing users
    query: {
        list: z
            .object({
                page: z.preprocess(
                    val => stringToNumber(val) || 1,
                    z.number().int().min(1).default(1)
                ),
                limit: z.preprocess(val => {
                    const num = stringToNumber(val) || 10;
                    return Math.min(Math.max(num, 1), 100); // Clamp between 1-100
                }, z.number().int().min(1).max(100).default(10)),
                search: z.string().optional(),
                email: z.string().email().optional().or(z.literal('')),
                sortBy: z.enum(['id', 'name', 'email', 'createdAt']).default('createdAt'),
                sortOrder: z.enum(['asc', 'desc']).default('desc'),
            })
            .transform(data => {
                // Clean up empty strings
                return {
                    ...data,
                    email: data.email === '' ? undefined : data.email,
                    search: data.search === '' ? undefined : data.search,
                };
            }),

        // Search-specific validation
        search: z
            .object({
                q: z.string().min(1, 'Search term is required').optional(),
                search: z.string().min(1, 'Search term is required').optional(),
                limit: z.preprocess(val => {
                    const num = stringToNumber(val) || 10;
                    return Math.min(Math.max(num, 1), 50); // Limit search results
                }, z.number().int().min(1).max(50).default(10)),
            })
            .refine(data => data.q || data.search, {
                message: 'Either "q" or "search" parameter is required',
                path: ['q'],
            }),
    },

    // Body validation schemas
    body: {
        create: z
            .object({
                email: z
                    .string()
                    .email('Invalid email address')
                    .min(5, 'Email must be at least 5 characters')
                    .max(255, 'Email must not exceed 255 characters')
                    .toLowerCase()
                    .trim(),
                name: z
                    .string()
                    .min(2, 'Name must be at least 2 characters')
                    .max(100, 'Name must not exceed 100 characters')
                    .trim()
                    .optional(),
                profile: z
                    .object({
                        bio: z
                            .string()
                            .max(500, 'Bio must not exceed 500 characters')
                            .trim()
                            .optional(),
                    })
                    .optional(),
            })
            .strict(),

        update: z
            .object({
                email: z
                    .string()
                    .email('Invalid email address')
                    .min(5, 'Email must be at least 5 characters')
                    .max(255, 'Email must not exceed 255 characters')
                    .toLowerCase()
                    .trim()
                    .optional(),
                name: z
                    .string()
                    .min(2, 'Name must be at least 2 characters')
                    .max(100, 'Name must not exceed 100 characters')
                    .trim()
                    .optional(),
            })
            .strict()
            .refine(data => Object.keys(data).length > 0, {
                message: 'At least one field must be provided for update',
            }),

        updateProfile: z
            .object({
                bio: z.string().max(500, 'Bio must not exceed 500 characters').trim().optional(),
            })
            .strict(),
    },
};

// Type exports for better TypeScript integration
export type CreateUserInput = z.infer<typeof UserValidation.body.create>;
export type UpdateUserInput = z.infer<typeof UserValidation.body.update>;
export type UpdateUserProfileInput = z.infer<typeof UserValidation.body.updateProfile>;
export type UserListQuery = z.infer<typeof UserValidation.query.list>;
export type UserSearchQuery = z.infer<typeof UserValidation.query.search>;
export type UserIdParams = z.infer<typeof UserValidation.params.id>;
