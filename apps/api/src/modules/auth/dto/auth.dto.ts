import { z } from 'zod';

export const RegisterSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export class RegisterDto {
  name!: string;
  email!: string;
  password!: string;
}

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
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
