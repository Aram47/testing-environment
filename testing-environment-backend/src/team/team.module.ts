import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { RealtimeCoreModule } from '../websocket/realtime-core.module';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';

@Module({
  imports: [AuditModule, RealtimeCoreModule],
  controllers: [TeamController],
  providers: [TeamService],
  exports: [TeamService],
})
export class TeamModule {}
