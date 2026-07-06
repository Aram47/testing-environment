import { Module } from '@nestjs/common';
import { EnvironmentImportModule } from '../environment-import/environment-import.module';
import { QueueCoreModule } from '../queue/queue-core.module';
import { RunnerModule } from '../runner/runner.module';
import { ComposeToVisualConverterService } from './compose-to-visual-converter.service';
import { EnvironmentConfigCompilerService } from './environment-config-compiler.service';
import { EnvironmentConfigsController } from './environment-configs.controller';
import { EnvironmentConfigsService } from './environment-configs.service';
import { EnvironmentDryRunModule } from './environment-dry-run.module';
import { EnvironmentDryRunsService } from './environment-dry-runs.service';
import { EnvironmentPreflightService } from './environment-preflight.service';

@Module({
  imports: [EnvironmentImportModule, RunnerModule, QueueCoreModule, EnvironmentDryRunModule],
  controllers: [EnvironmentConfigsController],
  providers: [
    EnvironmentConfigsService,
    EnvironmentConfigCompilerService,
    EnvironmentPreflightService,
    ComposeToVisualConverterService,
    EnvironmentDryRunsService,
  ],
  exports: [EnvironmentConfigsService, EnvironmentDryRunModule],
})
export class EnvironmentConfigsModule {}
