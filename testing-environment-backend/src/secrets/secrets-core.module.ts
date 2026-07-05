import { Module } from '@nestjs/common';
import { SecretAuditService } from './secret-audit.service';
import { SecretCryptoService } from './secret-crypto.service';
import { SecretMaskingService } from './secret-masking.service';
import { SecretReferenceResolverService } from './secret-reference-resolver.service';

@Module({
  providers: [
    SecretCryptoService,
    SecretAuditService,
    SecretMaskingService,
    SecretReferenceResolverService,
  ],
  exports: [
    SecretCryptoService,
    SecretAuditService,
    SecretMaskingService,
    SecretReferenceResolverService,
  ],
})
export class SecretsCoreModule {}
