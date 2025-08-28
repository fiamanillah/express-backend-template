// src/modules/User/user.validation.ts
import { z } from 'zod';

// Common validation schemas
export const UserValidation = {
    // ID parameter validation
    params: {
        id: z.object({
            id: z.string().min(1, 'User ID is required').regex(/^\d+$/, 'User ID must be a number'),
        }),
    },

    // Query parameter validation
    query: {
        list: z
            .object({
                page: z
                    .string()
                    .optional()
                    .transform(val => (val ? parseInt(val) : 1)),
                limit: z
                    .string()
                    .optional()
                    .transform(val => (val ? Math.min(parseInt(val) || 10, 100) : 10)),
                search: z.string().optional(),
                email: z.string().email().optional(),
                sortBy: z.enum(['id', 'name', 'email', 'createdAt']).optional(),
                sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
            })
            .refine(
                data => {
                    if (data.page && data.page < 1) return false;
                    if (data.limit && (data.limit < 1 || data.limit > 100)) return false;
                    return true;
                },
                {
                    message: 'Invalid pagination parameters',
                }
            ),
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
            .strict(), // Reject unknown properties

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
export type UserIdParams = z.infer<typeof UserValidation.params.id>;
