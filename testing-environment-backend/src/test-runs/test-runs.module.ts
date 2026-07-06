import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TestRunStateModule } from './test-run-state.module';
import { TestRunsController } from './test-runs.controller';
import { TestRunsService } from './test-runs.service';
import { TestRunDiagnosisService } from './test-run-diagnosis.service';
import { TestRunComparisonService } from './test-run-comparison.service';

@Module({
  imports: [QueueModule, SubscriptionsModule, TestRunStateModule],
  controllers: [TestRunsController],
  providers: [TestRunsService, TestRunDiagnosisService, TestRunComparisonService],
  exports: [TestRunDiagnosisService, TestRunComparisonService],
})
export class TestRunsModule {}
