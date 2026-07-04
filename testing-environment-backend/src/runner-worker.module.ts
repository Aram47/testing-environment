import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { QueueCoreModule } from './queue/queue-core.module';
import { RunnerModule } from './runner/runner.module';
import { TestRunWorkerProcessor } from './runner/test-run-worker.processor';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, QueueCoreModule, RunnerModule],
  providers: [TestRunWorkerProcessor],
})
export class RunnerWorkerModule {}
