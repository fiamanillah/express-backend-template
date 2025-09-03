// src/modules/Auth/auth.validation.ts
import { z } from 'zod';

// Password validation with security requirements
const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/^(?=.*[a-z])/, 'Password must contain at least one lowercase letter')
    .regex(/^(?=.*[A-Z])/, 'Password must contain at least one uppercase letter')
    .regex(/^(?=.*\d)/, 'Password must contain at least one number')
    .regex(/^(?=.*[!@#$%^&*(),.?":{}|<>])/, 'Password must contain at least one special character');

// Role validation
const roleSchema = z.enum(
    ['user', 'admin', 'moderator'],
    'Role must be one of: user, admin, moderator'
);

export const AuthValidation = {
    // Registration validation
    register: z
        .object({
            email: z
                .string()
                .email('Invalid email address')
                .min(5, 'Email must be at least 5 characters')
                .max(255, 'Email must not exceed 255 characters')
                .toLowerCase()
                .trim(),
            password: passwordSchema,
            confirmPassword: z.string(),
            name: z
                .string()
                .min(2, 'Name must be at least 2 characters')
                .max(100, 'Name must not exceed 100 characters')
                .trim()
                .optional(),
            role: roleSchema.optional().default('user'),
        })
        .strict()
        .refine(data => data.password === data.confirmPassword, {
            message: 'Passwords do not match',
            path: ['confirmPassword'],
        })
        .transform(data => {
            // Remove confirmPassword from the final object
            const { confirmPassword, ...rest } = data;
            return rest;
        }),

    // Login validation
    login: z
        .object({
            email: z.string().email('Invalid email address').toLowerCase().trim(),
            password: z.string().min(1, 'Password is required'),
        })
        .strict(),

    // Change password validation
    changePassword: z
        .object({
            currentPassword: z.string().min(1, 'Current password is required'),
            newPassword: passwordSchema,
            confirmNewPassword: z.string(),
        })
        .strict()
        .refine(data => data.newPassword === data.confirmNewPassword, {
            message: 'New passwords do not match',
            path: ['confirmNewPassword'],
        })
        .refine(data => data.currentPassword !== data.newPassword, {
            message: 'New password must be different from current password',
            path: ['newPassword'],
        })
        .transform(data => {
            // Remove confirmNewPassword from the final object
            const { confirmNewPassword, ...rest } = data;
            return rest;
        }),

    // Update role validation (admin only)
    updateRole: z
        .object({
            role: roleSchema,
        })
        .strict(),

    // Refresh token validation
    refreshToken: z
        .object({
            token: z.string().min(1, 'Token is required'),
        })
        .strict(),

    // Password reset request validation
    requestPasswordReset: z
        .object({
            email: z.string().email('Invalid email address').toLowerCase().trim(),
        })
        .strict(),

    // Password reset validation
    resetPassword: z
        .object({
            token: z.string().min(1, 'Reset token is required'),
            password: passwordSchema,
            confirmPassword: z.string(),
        })
        .strict()
        .refine(data => data.password === data.confirmPassword, {
            message: 'Passwords do not match',
            path: ['confirmPassword'],
        })
        .transform(data => {
            // Remove confirmPassword from the final object
            const { confirmPassword, ...rest } = data;
            return rest;
        }),

    // Parameter validation
    params: {
        userId: z.object({
            userId: z
                .string()
                .min(1, 'User ID is required')
                .regex(/^\d+$/, 'User ID must be a number'),
        }),
    },
};

// Type exports
export type RegisterInput = z.infer<typeof AuthValidation.register>;
export type LoginInput = z.infer<typeof AuthValidation.login>;
export type ChangePasswordInput = z.infer<typeof AuthValidation.changePassword>;
export type UpdateRoleInput = z.infer<typeof AuthValidation.updateRole>;
export type RefreshTokenInput = z.infer<typeof AuthValidation.refreshToken>;
export type RequestPasswordResetInput = z.infer<typeof AuthValidation.requestPasswordReset>;
export type ResetPasswordInput = z.infer<typeof AuthValidation.resetPassword>;
export type UserIdParams = z.infer<typeof AuthValidation.params.userId>;
