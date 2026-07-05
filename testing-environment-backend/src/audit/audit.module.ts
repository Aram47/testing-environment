import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from './audit.interceptor';
import { AuditSanitizerService } from './audit-sanitizer.service';
import { AuditService } from './audit.service';

@Module({
  controllers: [AuditController],
  providers: [
    AuditSanitizerService,
    AuditService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
  exports: [AuditService, AuditSanitizerService],
})
export class AuditModule {}
