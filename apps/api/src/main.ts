import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { AppExceptionFilter } from './common/exceptions/app-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'x-user-id', 'X-User-Id'],
  });

  app.useGlobalFilters(new AppExceptionFilter());
  app.enableShutdownHooks(); // gracefully close queues/workers on SIGTERM/SIGINT

  const port = parseInt(process.env.PORT || '4000', 10);
  await app.listen(port);
  console.log(`🚀 Worklane API server running on port ${port}`);
}

await bootstrap();
