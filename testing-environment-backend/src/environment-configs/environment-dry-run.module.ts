import { Module } from '@nestjs/common';
import { RunnerModule } from '../runner/runner.module';
import { SecretsCoreModule } from '../secrets/secrets-core.module';
import { EnvironmentDryRunOrchestratorService } from './environment-dry-run-orchestrator.service';
import { EnvironmentDryRunStateModule } from './environment-dry-run-state.module';

@Module({
  imports: [RunnerModule, SecretsCoreModule, EnvironmentDryRunStateModule],
  providers: [EnvironmentDryRunOrchestratorService],
  exports: [EnvironmentDryRunOrchestratorService, EnvironmentDryRunStateModule],
})
export class EnvironmentDryRunModule {}
