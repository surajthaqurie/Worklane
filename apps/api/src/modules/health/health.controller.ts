import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { db } from '../../db/kysely.js';
import { sql } from 'kysely';
import { Redis } from 'ioredis';

@Controller()
export class HealthController {
  private redisClient: Redis | null = null;

  constructor() {
    const redisHost = process.env.REDIS_HOST;
    if (redisHost) {
      try {
        this.redisClient = new Redis({
          host: redisHost,
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          password: process.env.REDIS_PASSWORD || undefined,
          lazyConnect: true,
          connectTimeout: 2000,
          maxRetriesPerRequest: 1,
        });
      } catch {
        this.redisClient = null;
      }
    }
  }

  @Get(['', 'health', 'api/v1/health'])
  async checkHealth(@Res() res: Response) {
    let dbStatus = 'down';
    let dbLatencyMs = 0;
    try {
      const dbStart = Date.now();
      await sql`SELECT 1`.execute(db);
      dbLatencyMs = Date.now() - dbStart;
      dbStatus = 'up';
    } catch {
      dbStatus = 'down';
    }

    let redisStatus = 'disabled';
    let redisLatencyMs = 0;
    if (this.redisClient) {
      try {
        const rStart = Date.now();
        await this.redisClient.ping();
        redisLatencyMs = Date.now() - rStart;
        redisStatus = 'up';
      } catch {
        redisStatus = 'down';
      }
    }

    const memory = process.memoryUsage();
    const isHealthy = dbStatus === 'up' && (redisStatus === 'up' || redisStatus === 'disabled');

    const result = {
      status: isHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      checks: {
        database: { status: dbStatus, latencyMs: dbLatencyMs },
        redis: { status: redisStatus, latencyMs: redisLatencyMs },
      },
      memory: {
        heapUsedMb: Math.round(memory.heapUsed / (1024 * 1024)),
        heapTotalMb: Math.round(memory.heapTotal / (1024 * 1024)),
        rssMb: Math.round(memory.rss / (1024 * 1024)),
      },
    };

    return res
      .status(isHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
      .json(result);
  }

  @Get(['metrics', 'api/v1/metrics'])
  async getMetrics(@Res() res: Response) {
    let dbUp = 0;
    try {
      await sql`SELECT 1`.execute(db);
      dbUp = 1;
    } catch {
      dbUp = 0;
    }

    let redisUp = 0;
    if (this.redisClient) {
      try {
        await this.redisClient.ping();
        redisUp = 1;
      } catch {
        redisUp = 0;
      }
    } else {
      redisUp = 1;
    }

    const memory = process.memoryUsage();
    const uptime = process.uptime();

    const metrics = [
      '# HELP worklane_uptime_seconds Process uptime in seconds',
      '# TYPE worklane_uptime_seconds gauge',
      `worklane_uptime_seconds ${uptime}`,
      '# HELP worklane_memory_heap_used_bytes Heap memory used in bytes',
      '# TYPE worklane_memory_heap_used_bytes gauge',
      `worklane_memory_heap_used_bytes ${memory.heapUsed}`,
      '# HELP worklane_memory_heap_total_bytes Heap memory total in bytes',
      '# TYPE worklane_memory_heap_total_bytes gauge',
      `worklane_memory_heap_total_bytes ${memory.heapTotal}`,
      '# HELP worklane_memory_rss_bytes Resident set size in bytes',
      '# TYPE worklane_memory_rss_bytes gauge',
      `worklane_memory_rss_bytes ${memory.rss}`,
      '# HELP worklane_db_status PostgreSQL database connection status (1=up, 0=down)',
      '# TYPE worklane_db_status gauge',
      `worklane_db_status ${dbUp}`,
      '# HELP worklane_redis_status Redis connection status (1=up, 0=down)',
      '# TYPE worklane_redis_status gauge',
      `worklane_redis_status ${redisUp}`,
    ].join('\n') + '\n';

    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    return res.status(HttpStatus.OK).send(metrics);
  }
}
