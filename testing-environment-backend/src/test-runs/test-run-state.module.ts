import { Module } from '@nestjs/common';
import { TestRunStateService } from './test-run-state.service';

@Module({
  providers: [TestRunStateService],
  exports: [TestRunStateService],
})
export class TestRunStateModule {}
