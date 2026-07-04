import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TestRunStateModule } from '../test-runs/test-run-state.module';
import { QueueCoreModule } from './queue-core.module';
import { TestRunQueueRecoveryService } from './test-run-queue-recovery.service';

@Module({
  imports: [ConfigModule, QueueCoreModule, TestRunStateModule],
  providers: [TestRunQueueRecoveryService],
  exports: [QueueCoreModule],
})
export class QueueModule {}
