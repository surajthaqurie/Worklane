import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationsGateway } from './notifications.gateway.js';
import { NotificationType } from './dto/notifications.dto.js';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../auth/auth.service.js';

function makeSocket(overrides: Partial<any> = {}) {
  return {
    id: 'socket-1',
    handshake: {
      auth: {},
      query: {},
      headers: {},
    },
    join: vi.fn(),
    leave: vi.fn(),
    ...overrides,
  } as any;
}

describe('NotificationsGateway (Phase 14)', () => {
  let gateway: NotificationsGateway;

  beforeEach(() => {
    gateway = new NotificationsGateway();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
  });

  describe('room authorization', () => {
    it('joins the caller room derived from a valid JWT (auth.token)', () => {
      const token = jwt.sign({ sub: 'user-42' }, JWT_SECRET, { algorithm: 'HS256' });
      const socket = makeSocket({ handshake: { auth: { token }, query: {}, headers: {} } });

      gateway.handleConnection(socket);

      expect(socket.join).toHaveBeenCalledWith('user:user-42');
    });

    it('joins the caller room derived from a valid JWT (query.token fallback)', () => {
      const token = jwt.sign({ sub: 'user-7' }, JWT_SECRET, { algorithm: 'HS256' });
      const socket = makeSocket({ handshake: { auth: {}, query: { token }, headers: {} } });

      gateway.handleConnection(socket);

      expect(socket.join).toHaveBeenCalledWith('user:user-7');
    });

    it('ignores a spoofed userId when the token is missing or invalid (non-test)', () => {
      const socket = makeSocket({
        handshake: { auth: {}, query: { userId: 'victim-user' }, headers: {} },
      });

      gateway.handleConnection(socket);

      expect(socket.join).not.toHaveBeenCalled();
    });

    it('rejects a tampered JWT even when auth.userId claims another user', () => {
      const socket = makeSocket({
        handshake: {
          auth: { token: 'not.a.jwt', userId: 'victim-user' },
          query: {},
          headers: {},
        },
      });

      gateway.handleConnection(socket);

      expect(socket.join).not.toHaveBeenCalled();
    });

    it('honors the legacy handshake only in test environments', () => {
      process.env.NODE_ENV = 'test';
      const socket = makeSocket({
        handshake: { auth: {}, query: { userId: 'test-user' }, headers: {} },
      });

      gateway.handleConnection(socket);

      expect(socket.join).toHaveBeenCalledWith('user:test-user');
    });

    it('subscribe allows only the authenticated user room and rejects others', () => {
      const token = jwt.sign({ sub: 'me' }, JWT_SECRET, { algorithm: 'HS256' });
      const socket = makeSocket({ handshake: { auth: { token }, query: {}, headers: {} } });

      const own = gateway.handleSubscribe(socket, { userId: 'me' });
      expect(own).toEqual({ event: 'subscribed', userId: 'me' });
      expect(socket.join).toHaveBeenCalledWith('user:me');

      const denied = gateway.handleSubscribe(socket, { userId: 'someone-else' });
      expect(denied).toEqual({ event: 'subscribe-error', reason: 'forbidden' });
    });
  });

  describe('targeted delivery (never global broadcast)', () => {
    it('emits only to the user:{id} room via the gateway server', () => {
      const emit = vi.fn();
      const to = vi.fn().mockReturnValue({ emit });
      gateway.server = { to } as any;

      const notification = {
        id: 'n-1',
        userId: 'user-a',
        type: NotificationType.ASSIGNED,
        workItemId: 'wi-1',
        actorId: 'actor-9',
        metadata: {},
        readAt: null,
        createdAt: new Date().toISOString(),
      };

      gateway.sendNotificationToUser('user-a', notification);

      expect(to).toHaveBeenCalledTimes(1);
      expect(to).toHaveBeenCalledWith('user:user-a');
      expect(emit).toHaveBeenCalledWith('notification', notification);
      // No broadcast helpers used — only `.to(room)` targeting.
      expect(gateway.server.emit).toBeUndefined();
    });
  });
});