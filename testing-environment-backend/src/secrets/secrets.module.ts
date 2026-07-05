import { Module } from '@nestjs/common';
import { QueueCoreModule } from '../queue/queue-core.module';
import { SecretRotationProcessor } from './secret-rotation.processor';
import { SecretRotationService } from './secret-rotation.service';
import { SecretRotationsController } from './secret-rotations.controller';
import { SecretsCoreModule } from './secrets-core.module';
import { SecretsController } from './secrets.controller';
import { SecretsService } from './secrets.service';

@Module({
  imports: [SecretsCoreModule, QueueCoreModule],
  controllers: [SecretsController, SecretRotationsController],
  providers: [SecretsService, SecretRotationService, SecretRotationProcessor],
  exports: [SecretsCoreModule, SecretsService],
})
export class SecretsModule {}
