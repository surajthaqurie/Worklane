import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  Logger,
  Optional,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../../db/kysely.js';
import type { RegisterDto, LoginDto, RefreshDto, ChangePasswordDto } from './dto/auth.dto.js';

import { AuditLoggerService } from '../audit/audit-logger.service.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-worklane-access-key-2026';
const ACCESS_TOKEN_EXPIRES_IN = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export interface TokenPayload {
  sub: string;
  email: string;
  name: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Optional() private readonly auditLogger?: AuditLoggerService,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private generateAccessToken(user: { id: string; email: string; name: string }): string {
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
    };
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
      algorithm: 'HS256',
    });
  }

  private async generateRefreshToken(userId: string): Promise<{ rawToken: string; id: string }> {
    const rawToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    const inserted = await db
      .insertInto('refresh_tokens')
      .values({
        user_id: userId,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
        revoked: false,
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();

    return { rawToken, id: inserted.id };
  }

  verifyAccessToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as TokenPayload;
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
    const { rawToken: refreshToken } = await this.generateRefreshToken(inserted.id);

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
    const { rawToken: refreshToken } = await this.generateRefreshToken(user.id);

    if (this.auditLogger) {
      void this.auditLogger.logEvent('LOGIN', user.id, null, { email: user.email });
    }

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

    // SECURITY: Detect Refresh Token Reuse
    if (tokenRecord.revoked) {
      this.logger.warn(
        `Refresh token reuse detected for user ${tokenRecord.user_id}. Revoking all active tokens.`,
      );
      await db
        .updateTable('refresh_tokens')
        .set({ revoked: true })
        .where('user_id', '=', tokenRecord.user_id)
        .execute();
      throw new UnauthorizedException(
        'Security alert: Refresh token reuse detected. All active sessions have been revoked.',
      );
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

    // Issue new access & refresh tokens first to capture the replacement token ID
    const accessToken = this.generateAccessToken(user);
    const { rawToken: newRefreshToken, id: newRefreshTokenId } = await this.generateRefreshToken(user.id);

    // Revoke old refresh token (Token rotation) and set lineage
    await db
      .updateTable('refresh_tokens')
      .set({ revoked: true, replaced_by_token_id: newRefreshTokenId })
      .where('id', '=', tokenRecord.id)
      .execute();

    return {
      user,
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await db
      .selectFrom('users')
      .where('id', '=', userId)
      .select(['id', 'password_hash'])
      .executeTakeFirst();

    if (!user || !user.password_hash) {
      throw new NotFoundException('User not found');
    }

    const isMatch = await bcrypt.compare(dto.currentPassword, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid current password');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);

    await db
      .updateTable('users')
      .set({ password_hash: newPasswordHash })
      .where('id', '=', userId)
      .execute();

    // Revoke all refresh tokens for this user upon password change (Session Invalidation)
    await db
      .updateTable('refresh_tokens')
      .set({ revoked: true })
      .where('user_id', '=', userId)
      .execute();

    return {
      success: true,
      message: 'Password changed successfully. All active sessions have been invalidated.',
    };
  }

  async logout(refreshToken?: string) {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      const tokenRecord = await db
        .selectFrom('refresh_tokens')
        .where('token_hash', '=', tokenHash)
        .select(['user_id'])
        .executeTakeFirst();

      await db
        .updateTable('refresh_tokens')
        .set({ revoked: true })
        .where('token_hash', '=', tokenHash)
        .execute();

      if (this.auditLogger) {
        void this.auditLogger.logEvent('LOGOUT', tokenRecord?.user_id || null);
      }
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
