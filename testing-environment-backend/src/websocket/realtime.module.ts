import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { RealtimeCoreModule } from './realtime-core.module';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [AuthModule, AuthorizationModule, RealtimeCoreModule],
  providers: [RealtimeGateway],
  exports: [RealtimeCoreModule],
})
export class RealtimeModule {}
