import { Module } from '@nestjs/common';
import { EnvironmentDryRunStateService } from './environment-dry-run-state.service';

@Module({
  providers: [EnvironmentDryRunStateService],
  exports: [EnvironmentDryRunStateService],
})
export class EnvironmentDryRunStateModule {}
