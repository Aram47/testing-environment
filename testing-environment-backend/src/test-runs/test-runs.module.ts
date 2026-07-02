import { Module } from '@nestjs/common';
import { RunnerModule } from '../runner/runner.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TestRunsController } from './test-runs.controller';
import { TestRunsService } from './test-runs.service';

@Module({
  imports: [RunnerModule, SubscriptionsModule],
  controllers: [TestRunsController],
  providers: [TestRunsService],
})
export class TestRunsModule {}
