import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AuthService } from './auth.service.js';
import { db } from '../../db/kysely.js';

const INTEGRATION = process.env.INTEGRATION === '1';

describe.skipIf(!INTEGRATION)('AuthService Integration', () => {
  let authService: AuthService;
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  let createdUserId: string;
  let refreshToken: string;

  beforeAll(() => {
    authService = new AuthService();
  });

  afterAll(async () => {
    if (createdUserId) {
      await db.deleteFrom('refresh_tokens').where('user_id', '=', createdUserId).execute();
      await db.deleteFrom('users').where('id', '=', createdUserId).execute();
    }
  });

  it('should register a new user and return tokens', async () => {
    const res = await authService.register({
      name: 'Test User',
      email: testEmail,
      password: testPassword,
    });

    expect(res.user).toBeDefined();
    expect(res.user.email).toBe(testEmail);
    expect(res.accessToken).toBeDefined();
    expect(res.refreshToken).toBeDefined();

    createdUserId = res.user.id;
  });

  it('should login with valid credentials', async () => {
    const res = await authService.login({
      email: testEmail,
      password: testPassword,
    });

    expect(res.user.id).toBe(createdUserId);
    expect(res.accessToken).toBeDefined();
    expect(res.refreshToken).toBeDefined();

    refreshToken = res.refreshToken;
  });

  it('should fail login with wrong password', async () => {
    await expect(
      authService.login({
        email: testEmail,
        password: 'WrongPassword!',
      }),
    ).rejects.toThrow();
  });

  it('should refresh access token and rotate refresh token', async () => {
    const res = await authService.refresh({ refreshToken });

    expect(res.accessToken).toBeDefined();
    expect(res.refreshToken).toBeDefined();
    expect(res.refreshToken).not.toEqual(refreshToken);

    // Update refreshToken for subsequent tests
    refreshToken = res.refreshToken;
  });

  it('should reject previously rotated refresh token', async () => {
    await expect(authService.refresh({ refreshToken: 'old-token' })).rejects.toThrow();
  });

  it('should logout and revoke refresh token', async () => {
    await authService.logout(refreshToken);

    await expect(authService.refresh({ refreshToken })).rejects.toThrow();
  });
});
