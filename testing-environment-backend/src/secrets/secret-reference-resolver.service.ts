import { BadRequestException, Injectable } from '@nestjs/common';
import { EnvironmentConfigRevision, TestSuiteRevision } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SecretAuditService } from './secret-audit.service';
import { SecretCryptoService } from './secret-crypto.service';
import { SecretMaskingContext, SecretMaskingService } from './secret-masking.service';

const SECRET_REFERENCE_PATTERN = /\{\{\s*secret\.([A-Z0-9_]{2,80})\s*\}\}/g;

export interface SecretExecutionContext {
  secrets: Map<string, string>;
  masking: SecretMaskingContext;
}

@Injectable()
export class SecretReferenceResolverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: SecretCryptoService,
    private readonly audit: SecretAuditService,
    private readonly masking: SecretMaskingService,
  ) {}

  findReferencedKeys(values: unknown[]): string[] {
    const keys = new Set<string>();
    for (const value of values) {
      const text = typeof value === 'string' ? value : JSON.stringify(value ?? {});
      for (const match of text.matchAll(SECRET_REFERENCE_PATTERN)) {
        keys.add(match[1]);
      }
    }
    return [...keys].sort();
  }

  async resolveForRun(
    projectId: string,
    companyId: string | undefined,
    testRunId: string,
    environmentRevision: EnvironmentConfigRevision,
    suiteRevisions: TestSuiteRevision[],
  ): Promise<SecretExecutionContext> {
    const keys = this.findReferencedKeys([
      environmentRevision.compiledComposeYaml,
      environmentRevision.compiledRuntimeYaml,
      environmentRevision.visualConfig,
      ...suiteRevisions.flatMap((revision) => [
        revision.compiledYaml,
        revision.executionPlan,
        revision.visualFlow,
      ]),
    ]);
    if (keys.length === 0) {
      return { secrets: new Map(), masking: this.masking.emptyContext() };
    }

    const secrets = await this.prisma.secret.findMany({
      where: { projectId, key: { in: keys } },
      orderBy: { key: 'asc' },
    });
    const foundKeys = new Set(secrets.map((secret) => secret.key));
    const missing = keys.filter((key) => !foundKeys.has(key));
    if (missing.length > 0) {
      throw new BadRequestException(`Missing project secret(s): ${missing.join(', ')}`);
    }

    const now = new Date();
    await this.prisma.secret.updateMany({
      where: { projectId, key: { in: keys } },
      data: { lastUsedAt: now },
    });

    const decrypted = new Map(
      secrets.map((secret) => [
        secret.key,
        this.crypto.decrypt(secret.encryptedValue, secret.encryptionKeyVersion),
      ]),
    );

    await Promise.all(
      secrets.map((secret) =>
        this.audit.record({
          type: 'secret.used_by_run',
          companyId,
          projectId,
          resourceId: secret.id,
          metadata: { key: secret.key, testRunId },
        }),
      ),
    );

    return {
      secrets: decrypted,
      masking: this.masking.createContext(decrypted.values()),
    };
  }

  replaceReferences<T>(value: T, secrets: Map<string, string>): T {
    if (typeof value === 'string') {
      return value.replace(
        SECRET_REFERENCE_PATTERN,
        (_match, key: string) => secrets.get(key) ?? '',
      ) as T;
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.replaceReferences(item, secrets)) as T;
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, nested]) => [
          key,
          this.replaceReferences(nested, secrets),
        ]),
      ) as T;
    }
    return value;
  }
}
