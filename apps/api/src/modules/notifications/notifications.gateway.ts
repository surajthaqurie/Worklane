import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { NotificationDto } from './dto/notifications.dto.js';
import { JWT_SECRET } from '../auth/auth.service.js';

/**
 * Real-time notification gateway.
 *
 * Security model:
 * - Clients may only join their OWN `user:{id}` room, derived from a verified
 *   JWT (socket.io `auth.token`). Spoofed `userId`s are ignored.
 * - Private notifications are only ever emitted to `user:{id}` rooms — never
 *   broadcast globally.
 * - In test environments (`NODE_ENV === 'test'`) the legacy `userId` /
 *   `x-user-id` handshake is honored as-is so E2E/unit harnesses keep working.
 */
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/notifications',
})
@Injectable()
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  handleConnection(client: Socket) {
    const userId = this.resolveAuthenticatedUserId(client);
    if (userId) {
      client.join(`user:${userId}`);
      this.logger.log(`Client ${client.id} joined room user:${userId}`);
    } else {
      // Do not leak whether the token was merely missing vs invalid; just refuse.
      this.logger.warn(`Client ${client.id} rejected: no valid authentication token`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId?: string },
  ) {
    const ownUserId = this.resolveAuthenticatedUserId(client);

    if (!data?.userId) {
      return { event: 'subscribe-error', reason: 'missing-user-id' };
    }

    // A client may only subscribe to its own room — never another user's.
    if (!ownUserId || data.userId !== ownUserId) {
      this.logger.warn(
        `Client ${client.id} attempted to subscribe to ${data.userId} (authenticated as ${ownUserId ?? 'unknown'}) — denied`,
      );
      return { event: 'subscribe-error', reason: 'forbidden' };
    }

    client.join(`user:${data.userId}`);
    this.logger.log(`Client ${client.id} subscribed to user:${data.userId}`);
    return { event: 'subscribed', userId: data.userId };
  }

  /**
   * Emit a private notification to a single user room. Never broadcasts globally.
   */
  sendNotificationToUser(userId: string, notification: NotificationDto) {
    if (this.server) {
      this.server.to(`user:${userId}`).emit('notification', notification);
    }
  }

  /**
   * Resolve the authenticated user id from the socket handshake.
   * Priority:
   *   1. `auth.token` (socket.io auth payload) / `query.token` — verified JWT
   *   2. Test-only fallback: `query.userId` / `header x-user-id` when NODE_ENV=test
   */
  resolveAuthenticatedUserId(client: Socket): string | null {
    const auth = (client.handshake.auth ?? {}) as Record<string, unknown>;
    const query = (client.handshake.query ?? {}) as Record<string, unknown>;

    const token = typeof auth.token === 'string'
      ? auth.token
      : typeof query.token === 'string'
        ? query.token
        : null;

    if (token) {
      try {
        const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as {
          sub?: string;
        };
        if (payload?.sub) {
          return payload.sub;
        }
      } catch {
        return null;
      }
    }

    // Test-only legacy handshake (mirrors AuthGuard's x-user-id escape hatch).
    if (process.env.NODE_ENV === 'test') {
      const raw = typeof query.userId === 'string'
        ? query.userId
        : typeof query['x-user-id'] === 'string'
          ? query['x-user-id']
          : (client.handshake.headers?.['x-user-id'] as string | undefined);
      if (raw) {
        return raw;
      }
    }

    return null;
  }
}