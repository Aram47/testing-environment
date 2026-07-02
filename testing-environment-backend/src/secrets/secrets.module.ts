import { Module } from '@nestjs/common';
import { SecretCryptoService } from './secret-crypto.service';
import { SecretsController } from './secrets.controller';
import { SecretsService } from './secrets.service';

@Module({
  controllers: [SecretsController],
  providers: [SecretsService, SecretCryptoService],
  exports: [SecretsService, SecretCryptoService],
})
export class SecretsModule {}
