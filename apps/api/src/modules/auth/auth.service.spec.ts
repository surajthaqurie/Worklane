import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AuthService } from './auth.service.js';
import { db } from '../../db/kysely.js';

const INTEGRATION = process.env.INTEGRATION === '1';

describe.skipIf(!INTEGRATION)('AuthService Integration & Security Verification', () => {
  let authService: AuthService;
  const testEmail = `test-${Date.now()}@example.com`;
  const initialPassword = 'Password123!';
  const updatedPassword = 'NewSecurePassword456!';
  let createdUserId: string;
  let activeAccessToken: string;
  let firstRefreshToken: string;
  let rotatedRefreshToken: string;

  beforeAll(() => {
    authService = new AuthService();
  });

  afterAll(async () => {
    if (createdUserId) {
      await db.deleteFrom('refresh_tokens').where('user_id', '=', createdUserId).execute();
      await db.deleteFrom('users').where('id', '=', createdUserId).execute();
    }
  });

  it('should register a new user with hashed password and return access & refresh tokens', async () => {
    const res = await authService.register({
      name: 'Security Test User',
      email: testEmail,
      password: initialPassword,
    });

    expect(res.user).toBeDefined();
    expect(res.user.email).toBe(testEmail);
    expect((res.user as any).password_hash).toBeUndefined(); // Never return password_hash
    expect(res.accessToken).toBeDefined();
    expect(res.refreshToken).toBeDefined();

    createdUserId = res.user.id;
  });

  it('should login successfully with correct credentials', async () => {
    const res = await authService.login({
      email: testEmail,
      password: initialPassword,
    });

    expect(res.user.id).toBe(createdUserId);
    expect(res.accessToken).toBeDefined();
    expect(res.refreshToken).toBeDefined();

    activeAccessToken = res.accessToken;
    firstRefreshToken = res.refreshToken;
  });

  it('should verify valid access token correctly', () => {
    const payload = authService.verifyAccessToken(activeAccessToken);
    expect(payload.sub).toBe(createdUserId);
  });

  it('should reject login with wrong password', async () => {
    await expect(
      authService.login({
        email: testEmail,
        password: 'IncorrectPassword!',
      }),
    ).rejects.toThrow('Invalid email or password');
  });

  it('should refresh access token and rotate refresh token with lineage', async () => {
    const res = await authService.refresh({ refreshToken: firstRefreshToken });

    expect(res.accessToken).toBeDefined();
    expect(res.refreshToken).toBeDefined();
    expect(res.refreshToken).not.toEqual(firstRefreshToken);

    rotatedRefreshToken = res.refreshToken;
  });

  it('should DETECT REUSE of rotated refresh token and REVOKE ALL user sessions', async () => {
    // Attempting to reuse firstRefreshToken (which was already rotated/revoked)
    await expect(
      authService.refresh({ refreshToken: firstRefreshToken }),
    ).rejects.toThrow('Security alert: Refresh token reuse detected');

    // Due to reuse detection, rotatedRefreshToken should NOW ALSO be revoked!
    await expect(
      authService.refresh({ refreshToken: rotatedRefreshToken }),
    ).rejects.toThrow();
  });

  it('should change password, verify old password fails, and revoke sessions', async () => {
    // Login to get fresh tokens
    const loginRes = await authService.login({
      email: testEmail,
      password: initialPassword,
    });
    const currentRefresh = loginRes.refreshToken;

    // Change password
    const changeRes = await authService.changePassword(createdUserId, {
      currentPassword: initialPassword,
      newPassword: updatedPassword,
    });
    expect(changeRes.success).toBe(true);

    // Old refresh token must be invalidated
    await expect(
      authService.refresh({ refreshToken: currentRefresh }),
    ).rejects.toThrow();

    // Old password login must fail
    await expect(
      authService.login({
        email: testEmail,
        password: initialPassword,
      }),
    ).rejects.toThrow('Invalid email or password');

    // New password login must succeed
    const newLoginRes = await authService.login({
      email: testEmail,
      password: updatedPassword,
    });
    expect(newLoginRes.user.id).toBe(createdUserId);
  });

  it('should logout and revoke current refresh token', async () => {
    const loginRes = await authService.login({
      email: testEmail,
      password: updatedPassword,
    });
    const tokenToRevoke = loginRes.refreshToken;

    await authService.logout(tokenToRevoke);

    await expect(
      authService.refresh({ refreshToken: tokenToRevoke }),
    ).rejects.toThrow();
  });
});
