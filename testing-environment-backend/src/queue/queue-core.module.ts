import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TestRunStateModule } from '../test-runs/test-run-state.module';
import { TEST_RUN_QUEUE } from './queue.constants';
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
  ],
  providers: [TestRunQueueService],
  exports: [BullModule, TestRunQueueService],
})
export class QueueCoreModule {}
