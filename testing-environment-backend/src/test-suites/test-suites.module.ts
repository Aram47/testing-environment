import { Module } from '@nestjs/common';
import { ExecutionPlanCompilerModule } from './execution-plan-compiler.module';
import { FlowSuiteCompilerService } from './flow-suite-compiler.service';
import { ApiImportService } from './import/api-import.service';
import { ImportFlowFactory } from './import/import-flow.factory';
import { ImportWarningService } from './import/import-warning.service';
import { BrunoImportParser } from './import/parsers/bruno-import.parser';
import { CurlImportParser } from './import/parsers/curl-import.parser';
import { ManualRequestImportParser } from './import/parsers/manual-request-import.parser';
import { OpenApiImportParser } from './import/parsers/openapi-import.parser';
import { PostmanImportParser } from './import/parsers/postman-import.parser';
import { TestSuitesController } from './test-suites.controller';
import { TestSuitesService } from './test-suites.service';

@Module({
  imports: [ExecutionPlanCompilerModule],
  controllers: [TestSuitesController],
  providers: [
    TestSuitesService,
    FlowSuiteCompilerService,
    ApiImportService,
    ImportFlowFactory,
    ImportWarningService,
    OpenApiImportParser,
    PostmanImportParser,
    BrunoImportParser,
    CurlImportParser,
    ManualRequestImportParser,
  ],
})
export class TestSuitesModule {}
