import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { RunnerWorkerModule } from './runner-worker.module';
import { StructuredLoggerService } from './observability/structured-logger.service';

async function bootstrap(): Promise<void> {
  const logger = new Logger('RunnerWorker');
  const app = await NestFactory.create(RunnerWorkerModule);
  const config = app.get(ConfigService);
  app.useLogger(app.get(StructuredLoggerService));
  app.enableShutdownHooks();

  const shutdown = async (signal: string): Promise<void> => {
    logger.log(`Received ${signal}, shutting down runner worker`);
    await app.close();
    process.exit(0);
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
  await app.listen(config.get<number>('WORKER_HEALTH_PORT', 3001), '0.0.0.0');
  logger.log('Runner worker started');
}

void bootstrap();
