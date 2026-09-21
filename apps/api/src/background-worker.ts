import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { BackgroundJobsModule } from './modules/background-jobs/background-jobs.module.js';
import { BackgroundJobsWorker } from './modules/background-jobs/queue/background-jobs.worker.js';

/**
 * Standalone background worker entrypoint.
 *
 * Runs only the BullMQ worker so queue consumption can be scaled out to
 * dedicated processes/containers without booting the HTTP+Socket server:
 *
 *   pnpm --filter api worker        # => nest start --entryFile background-worker
 *
 * NOTE: this must run through the tsc-compiled build (nest start / node dist),
 * NOT tsx. tsx uses esbuild, which does not emit `design:paramtypes` decorator
 * metadata, so Nest constructor-injected dependencies (repo, processor, queue)
 * would be undefined and every job would crash.
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(BackgroundJobsModule, {
    logger: ['log', 'error', 'warn'],
  });

  // onModuleInit already started the worker; resolve it so startup errors surface.
  app.get(BackgroundJobsWorker);

  const shutdown = async (signal: string) => {
    console.log(`[worker] Received ${signal}, shutting down...`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  console.log('🚀 Worklane background worker running');
}

await bootstrap().catch((err) => {
  console.error('Failed to start background worker:', err);
  process.exit(1);
});