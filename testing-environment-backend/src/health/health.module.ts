import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { DockerHealthService } from './docker-health.service';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [HealthController],
  providers: [DockerHealthService, HealthService],
})
export class HealthModule {}
