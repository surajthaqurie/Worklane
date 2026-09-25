import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { AppExceptionFilter } from './common/exceptions/app-exception.filter.js';
import { RedisIoAdapter } from './common/adapters/redis-io.adapter.js';
import { runMigrations } from './db/migrate.js';

async function bootstrap() {
  // Run database migrations on startup if configured or in production
  if (process.env.RUN_MIGRATIONS === 'true' || process.env.NODE_ENV === 'production') {
    try {
      await runMigrations();
    } catch (err) {
      console.error('Failed to run migrations on startup:', err);
    }
  }

  const app = await NestFactory.create(AppModule);

  // Security headers with helmet
  app.use(
    helmet({
      contentSecurityPolicy: false, // disabled for OpenAPI/Swagger UI asset loading
      crossOriginEmbedderPolicy: false,
    }),
  );

  const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map((o) => o.trim());

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      if (
        corsOrigins.includes('*') ||
        corsOrigins.includes(origin) ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'x-user-id',
      'X-User-Id',
      'x-request-id',
      'X-Request-Id',
      'x-idempotency-key',
      'X-Idempotency-Key',
    ],
    exposedHeaders: ['X-Request-Id', 'x-request-id'],
  });

  // Backward-compatible routing rewrite for non-versioned requests
  app.use((req: any, _res: any, next: any) => {
    const p = req.path || '';
    if (
      !p.startsWith('/api/v1') &&
      !p.startsWith('/docs') &&
      !p.startsWith('/health') &&
      !p.startsWith('/metrics') &&
      !p.startsWith('/socket.io')
    ) {
      req.url = `/api/v1${req.url}`;
    }
    next();
  });

  // Global API versioning prefix: /api/v1
  app.setGlobalPrefix('api/v1', {
    exclude: ['', 'health', 'metrics', 'docs', 'docs-json', 'api/docs', 'api/docs-json'],
  });

  // Swagger / OpenAPI documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Worklane API')
    .setDescription('Enterprise Agile & Issue Tracking Engine (Azure Boards-inspired)')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your Bearer access token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Organizations', 'Multi-tenant organization management and workspace isolation')
    .addTag('Projects', 'Project management, settings, and member access')
    .addTag('Work Items', 'Backlog work items, hierarchy, transitions, and state management')
    .addTag('Boards', 'Kanban and scrum boards, columns, card rules, and swimlanes')
    .addTag('Iterations', 'Sprints, timeboxes, and iteration paths')
    .addTag('Teams', 'Team ownership, team areas, and sprint schedules')
    .addTag('Delivery Plans', 'Cross-team roadmap planning and work item dependencies')
    .addTag('Queries', 'Custom work item query builder and shared views')
    .addTag('Dashboards', 'Configurable widget dashboards and team metrics')
    .addTag('Attachments', 'File uploads, presigned URLs, and virus scanning')
    .addTag('Notifications', 'In-app real-time notification feeds and email delivery preferences')
    .addTag('Audit', 'Security audit trail and work-item revision history')
    .addTag('Auth', 'User authentication, password hashing, and refresh token rotation')
    .addTag('Health', 'Service health check and Prometheus telemetry metrics')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'Worklane API Documentation',
  });
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'Worklane API Documentation',
  });
  SwaggerModule.setup('api/v1/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'Worklane API Documentation',
  });

  // Socket.IO clustering via Redis adapter
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  app.useGlobalFilters(new AppExceptionFilter());
  app.enableShutdownHooks(); // gracefully close queues/workers on SIGTERM/SIGINT

  const port = parseInt(process.env.PORT || '4000', 10);
  await app.listen(port);
  console.log(`🚀 Worklane API server running on port ${port} (/api/v1)`);
  console.log(`📖 Swagger API documentation available at http://localhost:${port}/docs`);
}

await bootstrap();
