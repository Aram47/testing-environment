import { Module } from '@nestjs/common';
import { ExecutionPlanCompilerModule } from './execution-plan-compiler.module';
import { FlowSuiteCompilerService } from './flow-suite-compiler.service';
import { TestSuitesController } from './test-suites.controller';
import { TestSuitesService } from './test-suites.service';

@Module({
  imports: [ExecutionPlanCompilerModule],
  controllers: [TestSuitesController],
  providers: [TestSuitesService, FlowSuiteCompilerService],
})
export class TestSuitesModule {}
