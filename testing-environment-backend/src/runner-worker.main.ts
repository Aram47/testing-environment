import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { RunnerWorkerModule } from './runner-worker.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('RunnerWorker');
  const app = await NestFactory.createApplicationContext(RunnerWorkerModule);
  app.enableShutdownHooks();

  const shutdown = async (signal: string): Promise<void> => {
    logger.log(`Received ${signal}, shutting down runner worker`);
    await app.close();
    process.exit(0);
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
  logger.log('Runner worker started');
}

void bootstrap();
