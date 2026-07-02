import { Module } from '@nestjs/common';
import { EnvironmentConfigCompilerService } from './environment-config-compiler.service';
import { EnvironmentConfigsController } from './environment-configs.controller';
import { EnvironmentConfigsService } from './environment-configs.service';

@Module({
  controllers: [EnvironmentConfigsController],
  providers: [EnvironmentConfigsService, EnvironmentConfigCompilerService],
})
export class EnvironmentConfigsModule {}
