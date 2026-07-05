import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '../prisma/prisma.module';
import { ContextEnrichmentInterceptor } from './context-enrichment.interceptor';
import { ExecutionContextService } from './execution-context.service';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { RedactionService } from './redaction.service';
import { RequestContextMiddleware } from './request-context.middleware';
import { StructuredLoggerService } from './structured-logger.service';
import { TracingService } from './tracing.service';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [MetricsController],
  providers: [
    ExecutionContextService,
    MetricsService,
    RedactionService,
    RequestContextMiddleware,
    StructuredLoggerService,
    TracingService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ContextEnrichmentInterceptor,
    },
  ],
  exports: [
    ExecutionContextService,
    MetricsService,
    RedactionService,
    RequestContextMiddleware,
    StructuredLoggerService,
    TracingService,
  ],
})
export class ObservabilityModule {}
