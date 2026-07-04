import { Module } from '@nestjs/common';
import { QueueCoreModule } from './queue-core.module';
import { TestRunQueueRecoveryService } from './test-run-queue-recovery.service';

@Module({
  imports: [QueueCoreModule],
  providers: [TestRunQueueRecoveryService],
  exports: [QueueCoreModule],
})
export class QueueModule {}
