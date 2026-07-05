import { Module } from '@nestjs/common';
import { EnvironmentImportAnalyzerService } from './environment-import-analyzer.service';

@Module({
  providers: [EnvironmentImportAnalyzerService],
  exports: [EnvironmentImportAnalyzerService],
})
export class EnvironmentImportModule {}
