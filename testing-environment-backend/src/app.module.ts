import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiTokensModule } from './api-tokens/api-tokens.module';
import { ArtifactsModule } from './artifacts/artifacts.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { AuthorizationModule } from './authorization/authorization.module';
import { CommonModule } from './common/common.module';
import { CompaniesModule } from './companies/companies.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { EnvironmentConfigsModule } from './environment-configs/environment-configs.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { ReportsModule } from './reports/reports.module';
import { SecretsModule } from './secrets/secrets.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { TestRunsModule } from './test-runs/test-runs.module';
import { TestSuitesModule } from './test-suites/test-suites.module';
import { TeamModule } from './team/team.module';
import { UsersModule } from './users/users.module';
import { RealtimeModule } from './websocket/realtime.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthorizationModule,
    CommonModule,
    ArtifactsModule,
    AuditModule,
    ApiTokensModule,
    AuthModule,
    UsersModule,
    CompaniesModule,
    DashboardModule,
    SubscriptionsModule,
    ProjectsModule,
    EnvironmentConfigsModule,
    SecretsModule,
    TeamModule,
    TestSuitesModule,
    TestRunsModule,
    ReportsModule,
    RealtimeModule,
    HealthModule,
  ],
})
export class AppModule {}
