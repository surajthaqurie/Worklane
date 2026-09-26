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

export function generateDefaultOrganizationName(name: string): string {
  const trimmed = name?.trim();
  if (!trimmed) {
    return 'Default Organization';
  }
  if (trimmed.endsWith("'s") || trimmed.endsWith("’s")) {
    return `${trimmed} Organization`;
  }
  if (trimmed.endsWith('s') || trimmed.endsWith('S')) {
    return `${trimmed}' Organization`;
  }
  return `${trimmed}'s Organization`;
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

    return await db.transaction().execute(async (trx) => {
      // 1. Create User
      const insertedUser = await trx
        .insertInto('users')
        .values({
          name: dto.name.trim(),
          email: dto.email.toLowerCase().trim(),
          password_hash: passwordHash,
        })
        .returning(['id', 'name', 'email', 'avatar_url', 'created_at'])
        .executeTakeFirstOrThrow();

      // 2. Generate Default Organization Name & Create Organization
      const orgName = generateDefaultOrganizationName(insertedUser.name);
      const insertedOrg = await trx
        .insertInto('organizations')
        .values({
          name: orgName,
          created_by: insertedUser.id,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // 3. Create Organization Membership with OWNER role (Super Admin)
      await trx
        .insertInto('organization_members')
        .values({
          organization_id: insertedOrg.id,
          user_id: insertedUser.id,
          role: 'OWNER',
        })
        .execute();

      // 4. Create Default Project
      const project = await trx
        .insertInto('projects')
        .values({
          name: 'My First Project',
          key: 'MYP',
          description: 'Default project created during onboarding',
          created_by: insertedUser.id,
          organization_id: insertedOrg.id,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // 5. Create Default Work Item States
      await trx
        .insertInto('work_item_states')
        .values([
          { project_id: project.id, name: 'To Do', key: 'TODO', color: '#94A3B8', sort_order: 0, is_done: false, category: 'PROPOSED', is_default: true },
          { project_id: project.id, name: 'In Progress', key: 'IN_PROGRESS', color: '#3B82F6', sort_order: 1, is_done: false, category: 'IN_PROGRESS', is_default: true },
          { project_id: project.id, name: 'Done', key: 'DONE', color: '#22C55E', sort_order: 2, is_done: true, category: 'COMPLETED', is_default: true },
        ])
        .execute();

      // 6. Create Default Area, Team, and Team Configuration
      const area = await trx
        .insertInto('areas')
        .values({ project_id: project.id, name: project.name, parent_id: null })
        .returningAll()
        .executeTakeFirstOrThrow();

      const team = await trx
        .insertInto('teams')
        .values({
          project_id: project.id,
          name: `${project.name} Team`,
          description: `Default team for ${project.name}`,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await trx
        .insertInto('team_configurations')
        .values({
          team_id: team.id,
          board_config: { collapsedCategories: false, hideEmptyColumns: false },
          backlog_config: { showInProgressItems: false },
          default_area_id: area.id,
          default_iteration_id: null,
        })
        .execute();

      await trx
        .insertInto('team_areas')
        .values({ team_id: team.id, area_id: area.id })
        .execute();

      await trx
        .insertInto('team_members')
        .values({ team_id: team.id, user_id: insertedUser.id, role: 'ADMIN' })
        .execute();

      // Creator automatically becomes OWNER in project_members
      await trx
        .insertInto('project_members')
        .values({ project_id: project.id, user_id: insertedUser.id, role: 'OWNER' })
        .execute();

      // 7. Tokens
      const accessToken = this.generateAccessToken(insertedUser);
      const rawRefreshToken = crypto.randomBytes(40).toString('hex');
      const tokenHash = this.hashToken(rawRefreshToken);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

      await trx
        .insertInto('refresh_tokens')
        .values({
          user_id: insertedUser.id,
          token_hash: tokenHash,
          expires_at: expiresAt.toISOString(),
          revoked: false,
        })
        .execute();

      return {
        user: insertedUser,
        organization: {
          id: insertedOrg.id,
          name: insertedOrg.name,
          role: 'OWNER' as const,
        },
        accessToken,
        refreshToken: rawRefreshToken,
      };
    });
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

    const userOrg = await db
      .selectFrom('organization_members as om')
      .innerJoin('organizations as o', 'o.id', 'om.organization_id')
      .where('om.user_id', '=', user.id)
      .select(['o.id', 'o.name', 'om.role'])
      .orderBy('om.created_at', 'asc')
      .executeTakeFirst();

    const { password_hash: _password_hash, ...userProfile } = user;

    return {
      user: userProfile,
      organization: userOrg
        ? { id: userOrg.id, name: userOrg.name, role: userOrg.role }
        : null,
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
