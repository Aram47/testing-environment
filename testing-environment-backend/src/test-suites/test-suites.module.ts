import { Module } from '@nestjs/common';
import { FlowSuiteCompilerService } from './flow-suite-compiler.service';
import { TestSuitesController } from './test-suites.controller';
import { TestSuitesService } from './test-suites.service';

@Module({
  controllers: [TestSuitesController],
  providers: [TestSuitesService, FlowSuiteCompilerService],
})
export class TestSuitesModule {}
