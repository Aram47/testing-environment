import { Module } from '@nestjs/common';
import { ExecutionPlanCompilerService } from './execution-plan-compiler.service';
import { VisualDslMigratorService } from './visual-dsl-migrator.service';
import { YamlSuiteAdapterService } from './yaml-suite-adapter.service';

@Module({
  providers: [ExecutionPlanCompilerService, VisualDslMigratorService, YamlSuiteAdapterService],
  exports: [ExecutionPlanCompilerService, YamlSuiteAdapterService],
})
export class ExecutionPlanCompilerModule {}
