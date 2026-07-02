import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { CompaniesModule } from './companies/companies.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { EnvironmentConfigsModule } from './environment-configs/environment-configs.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { ReportsModule } from './reports/reports.module';
import { RunnerModule } from './runner/runner.module';
import { SecretsModule } from './secrets/secrets.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { TestRunsModule } from './test-runs/test-runs.module';
import { TestSuitesModule } from './test-suites/test-suites.module';
import { UsersModule } from './users/users.module';
import { RealtimeModule } from './websocket/realtime.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CommonModule,
    AuthModule,
    UsersModule,
    CompaniesModule,
    DashboardModule,
    SubscriptionsModule,
    ProjectsModule,
    EnvironmentConfigsModule,
    SecretsModule,
    TestSuitesModule,
    TestRunsModule,
    RunnerModule,
    ReportsModule,
    RealtimeModule,
  ],
})
export class AppModule {}
