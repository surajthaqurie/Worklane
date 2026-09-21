import { describe, it, expect, afterEach } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { NotificationsGateway } from './notifications.gateway.js';
import { NotificationType } from './dto/notifications.dto.js';
import { JWT_SECRET } from '../auth/auth.service.js';

/**
 * Real-time delivery isolation test (Phase 14).
 *
 * Spins up a real Socket.IO server + two real clients and verifies that a
 * private notification emitted for one user is delivered ONLY to that user's
 * room — never to another connected client (no global broadcast).
 */
describe('NotificationsGateway — real-time delivery (Phase 14)', () => {
  let httpServer: HttpServer;
  let sio: Server;
  const clients: ClientSocket[] = [];

  afterEach(async () => {
    for (const c of clients) c.disconnect();
    clients.length = 0;
    if (sio) await new Promise<void>((resolve) => sio.close(() => resolve()));
    if (httpServer?.listening) {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });

  async function startServer() {
    httpServer = createServer();
    sio = new Server(httpServer, {
      cors: { origin: '*' },
      path: '/rt-notifications',
      transports: ['websocket', 'polling'],
    });

    const gateway = new NotificationsGateway();
    gateway.server = sio;
    sio.on('connection', (socket) => {
      gateway.handleConnection(socket);
      // Mirrors the @SubscribeMessage('subscribe') wiring Nest normally provides.
      socket.on('subscribe', (data: unknown, ack?: (res: unknown) => void) => {
        const result = gateway.handleSubscribe(socket as any, data as { userId?: string });
        if (typeof ack === 'function') ack(result);
      });
    });

    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const port = (httpServer.address() as AddressInfo).port;

    return { gateway, port };
  }

  function connectUser(port: number, token: string): Promise<ClientSocket> {
    return new Promise((resolve, reject) => {
      const client = createClient(`http://localhost:${port}`, {
        path: '/rt-notifications',
        transports: ['websocket', 'polling'],
        auth: { token },
        reconnection: false,
      });
      clients.push(client);
      client.once('connect', () => resolve(client));
      client.once('connect_error', (err) => reject(err));
      setTimeout(() => reject(new Error('connect timeout')), 5000).unref?.();
    });
  }

  it('delivers a notification only to the targeted user room', async () => {
    const { gateway, port } = await startServer();
    const aliceToken = jwt.sign({ sub: 'alice' }, JWT_SECRET, { algorithm: 'HS256' });
    const bobToken = jwt.sign({ sub: 'bob' }, JWT_SECRET, { algorithm: 'HS256' });

    const alice = await connectUser(port, aliceToken);
    const bob = await connectUser(port, bobToken);

    const aliceEvents: any[] = [];
    const bobEvents: any[] = [];
    alice.on('notification', (payload: unknown) => aliceEvents.push(payload));
    bob.on('notification', (payload: unknown) => bobEvents.push(payload));

    const notification = {
      id: 'rt-1',
      userId: 'alice',
      type: NotificationType.MENTIONED,
      workItemId: 'wi-1',
      actorId: 'bob',
      metadata: { title: 'Real-time title', key: 'PROJ-1' },
      readAt: null,
      createdAt: new Date().toISOString(),
    };

    gateway.sendNotificationToUser('alice', notification);

    // Give the event loop a tick to flush the room broadcast.
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(aliceEvents).toHaveLength(1);
    expect(aliceEvents[0]).toMatchObject({ id: 'rt-1', userId: 'alice' });
    // Bob must never receive Alice's private notification.
    expect(bobEvents).toHaveLength(0);
  });

  it('rejects cross-user subscription over a live connection', async () => {
    const { gateway, port } = await startServer();
    const aliceToken = jwt.sign({ sub: 'alice' }, JWT_SECRET, { algorithm: 'HS256' });

    const alice = await connectUser(port, aliceToken);

    const ack = await new Promise<{ event: string; reason?: string }>((resolve) => {
      alice.emit('subscribe', { userId: 'victim' }, (response: unknown) => {
        resolve(response as { event: string; reason?: string });
      });
    });

    expect(ack.event).toBe('subscribe-error');
    expect(ack.reason).toBe('forbidden');
    void gateway;
  });
});