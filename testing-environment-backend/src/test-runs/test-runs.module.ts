import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TestRunStateModule } from './test-run-state.module';
import { TestRunsController } from './test-runs.controller';
import { TestRunsService } from './test-runs.service';

@Module({
  imports: [QueueModule, SubscriptionsModule, TestRunStateModule],
  controllers: [TestRunsController],
  providers: [TestRunsService],
})
export class TestRunsModule {}
