import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ArtifactsModule } from './artifacts/artifacts.module';
import { HealthModule } from './health/health.module';
import { ObservabilityModule } from './observability/observability.module';
import { PrismaModule } from './prisma/prisma.module';
import { EnvironmentDryRunModule } from './environment-configs/environment-dry-run.module';
import { QueueCoreModule } from './queue/queue-core.module';
import { RunnerModule } from './runner/runner.module';
import { TestRunWorkerProcessor } from './runner/test-run-worker.processor';
import { TestRunStateModule } from './test-runs/test-run-state.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ObservabilityModule,
    HealthModule,
    QueueCoreModule,
    ArtifactsModule,
    RunnerModule,
    EnvironmentDryRunModule,
    TestRunStateModule,
  ],
  providers: [TestRunWorkerProcessor],
})
export class RunnerWorkerModule {}
