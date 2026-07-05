import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { RealtimeCoreModule } from '../websocket/realtime-core.module';
import { ApiTokensController } from './api-tokens.controller';
import { ApiTokensService } from './api-tokens.service';

@Module({
  imports: [AuditModule, RealtimeCoreModule],
  controllers: [ApiTokensController],
  providers: [ApiTokensService],
  exports: [ApiTokensService],
})
export class ApiTokensModule {}
