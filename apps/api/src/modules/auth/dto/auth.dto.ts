import { z } from 'zod';

export const RegisterSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255, 'Name too long'),
  email: z.string().trim().email('Invalid email address').max(255, 'Email too long'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password cannot exceed 72 characters'),
});

export class RegisterDto {
  name!: string;
  email!: string;
  password!: string;
}

export const LoginSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(255, 'Email too long'),
  password: z.string().min(1, 'Password is required').max(72, 'Password cannot exceed 72 characters'),
});

export class LoginDto {
  email!: string;
  password!: string;
}

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export class RefreshDto {
  refreshToken!: string;
}

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(72),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .max(72, 'New password cannot exceed 72 characters'),
});

export class ChangePasswordDto {
  currentPassword!: string;
  newPassword!: string;
}
