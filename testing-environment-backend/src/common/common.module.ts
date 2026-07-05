import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthorizationModule } from '../authorization/authorization.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ProjectAccessService } from './services/project-access.service';

@Global()
@Module({
  imports: [
    AuthorizationModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev-secret-change-me'),
      }),
    }),
  ],
  providers: [JwtAuthGuard, ProjectAccessService],
  exports: [JwtModule, JwtAuthGuard, ProjectAccessService],
})
export class CommonModule {}
