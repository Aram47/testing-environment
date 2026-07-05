import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TestRunStateModule } from '../test-runs/test-run-state.module';
import { ARTIFACT_RETENTION_QUEUE, SECRET_ROTATION_QUEUE, TEST_RUN_QUEUE } from './queue.constants';
import { TestRunQueueService } from './test-run-queue.service';

@Module({
  imports: [
    TestRunStateModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.get<string>('REDIS_URL', 'redis://localhost:6379') },
      }),
    }),
    BullModule.registerQueue({
      name: TEST_RUN_QUEUE,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: 1000,
        removeOnFail: false,
      },
    }),
    BullModule.registerQueue({
      name: SECRET_ROTATION_QUEUE,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: false,
      },
    }),
    BullModule.registerQueue({
      name: ARTIFACT_RETENTION_QUEUE,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: false,
      },
    }),
  ],
  providers: [TestRunQueueService],
  exports: [BullModule, TestRunQueueService],
})
export class QueueCoreModule {}
