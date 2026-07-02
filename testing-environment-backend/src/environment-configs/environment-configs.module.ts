import { Module } from '@nestjs/common';
import { EnvironmentConfigsController } from './environment-configs.controller';
import { EnvironmentConfigsService } from './environment-configs.service';

@Module({
  controllers: [EnvironmentConfigsController],
  providers: [EnvironmentConfigsService],
})
export class EnvironmentConfigsModule {}
