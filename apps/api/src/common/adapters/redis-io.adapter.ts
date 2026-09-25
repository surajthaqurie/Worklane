import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { Logger } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  protected override readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | undefined;

  async connectToRedis(): Promise<void> {
    const host = process.env.REDIS_HOST;
    if (!host) {
      this.logger.log('REDIS_HOST not configured. Socket.IO using default in-memory adapter.');
      return;
    }

    try {
      const port = parseInt(process.env.REDIS_PORT || '6379', 10);
      const password = process.env.REDIS_PASSWORD || undefined;

      const pubClient = new Redis({
        host,
        port,
        password,
        lazyConnect: true,
        connectTimeout: 5000,
        maxRetriesPerRequest: 3,
      });

      const subClient = pubClient.duplicate();

      await Promise.all([pubClient.connect(), subClient.connect()]);

      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.logger.log(`Socket.IO Redis adapter connected at ${host}:${port} for horizontal clustering.`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Could not connect Socket.IO Redis adapter (${errorMsg}). Falling back to in-memory.`);
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
