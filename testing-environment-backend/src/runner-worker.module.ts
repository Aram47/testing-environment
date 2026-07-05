import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { QueueCoreModule } from './queue/queue-core.module';
import { RunnerModule } from './runner/runner.module';
import { TestRunWorkerProcessor } from './runner/test-run-worker.processor';
import { TestRunStateModule } from './test-runs/test-run-state.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    QueueCoreModule,
    RunnerModule,
    TestRunStateModule,
  ],
  providers: [TestRunWorkerProcessor],
})
export class RunnerWorkerModule {}
