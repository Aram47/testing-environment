import { Module } from '@nestjs/common';
import { ExecutionPlanCompilerService } from './execution-plan-compiler.service';
import { FlowSuiteCompilerService } from './flow-suite-compiler.service';
import { TestSuitesController } from './test-suites.controller';
import { TestSuitesService } from './test-suites.service';
import { VisualDslMigratorService } from './visual-dsl-migrator.service';
import { YamlSuiteAdapterService } from './yaml-suite-adapter.service';

@Module({
  controllers: [TestSuitesController],
  providers: [
    TestSuitesService,
    FlowSuiteCompilerService,
    ExecutionPlanCompilerService,
    VisualDslMigratorService,
    YamlSuiteAdapterService,
  ],
  exports: [ExecutionPlanCompilerService, YamlSuiteAdapterService],
})
export class TestSuitesModule {}
