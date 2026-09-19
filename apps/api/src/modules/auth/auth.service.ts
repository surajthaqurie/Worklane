import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../../db/kysely.js';
import type { RegisterDto, LoginDto, RefreshDto } from './dto/auth.dto.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-worklane-access-key-2026';
const ACCESS_TOKEN_EXPIRES_IN = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export interface TokenPayload {
  sub: string;
  email: string;
  name: string;
}

@Injectable()
export class AuthService {
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private generateAccessToken(user: { id: string; email: string; name: string }): string {
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    const rawToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await db
      .insertInto('refresh_tokens')
      .values({
        user_id: userId,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
        revoked: false,
      })
      .execute();

    return rawToken;
  }

  verifyAccessToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  async register(dto: RegisterDto) {
    const existing = await db
      .selectFrom('users')
      .where('email', '=', dto.email.toLowerCase().trim())
      .select(['id'])
      .executeTakeFirst();

    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const inserted = await db
      .insertInto('users')
      .values({
        name: dto.name.trim(),
        email: dto.email.toLowerCase().trim(),
        password_hash: passwordHash,
      })
      .returning(['id', 'name', 'email', 'avatar_url', 'created_at'])
      .executeTakeFirstOrThrow();

    const accessToken = this.generateAccessToken(inserted);
    const refreshToken = await this.generateRefreshToken(inserted.id);

    return {
      user: inserted,
      accessToken,
      refreshToken,
    };
  }

  async login(dto: LoginDto) {
    const user = await db
      .selectFrom('users')
      .where('email', '=', dto.email.toLowerCase().trim())
      .select(['id', 'name', 'email', 'password_hash', 'avatar_url', 'created_at'])
      .executeTakeFirst();

    if (!user || !user.password_hash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user.id);

    const { password_hash: _password_hash, ...userProfile } = user;

    return {
      user: userProfile,
      accessToken,
      refreshToken,
    };
  }

  async refresh(dto: RefreshDto) {
    if (!dto.refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const tokenHash = this.hashToken(dto.refreshToken);

    const tokenRecord = await db
      .selectFrom('refresh_tokens')
      .where('token_hash', '=', tokenHash)
      .selectAll()
      .executeTakeFirst();

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (tokenRecord.revoked) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await db
      .selectFrom('users')
      .where('id', '=', tokenRecord.user_id)
      .select(['id', 'name', 'email', 'avatar_url', 'created_at'])
      .executeTakeFirst();

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Revoke old refresh token (Token rotation)
    await db
      .updateTable('refresh_tokens')
      .set({ revoked: true })
      .where('id', '=', tokenRecord.id)
      .execute();

    // Issue new access & refresh tokens
    const accessToken = this.generateAccessToken(user);
    const newRefreshToken = await this.generateRefreshToken(user.id);

    return {
      user,
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(refreshToken?: string) {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await db
        .updateTable('refresh_tokens')
        .set({ revoked: true })
        .where('token_hash', '=', tokenHash)
        .execute();
    }
    return { success: true, message: 'Logged out successfully' };
  }

  async getMe(userId: string) {
    const user = await db
      .selectFrom('users')
      .where('id', '=', userId)
      .select(['id', 'name', 'email', 'avatar_url', 'created_at'])
      .executeTakeFirst();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}
