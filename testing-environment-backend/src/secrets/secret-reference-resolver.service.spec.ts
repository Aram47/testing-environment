import { SecretAuditService } from './secret-audit.service';
import { SecretCryptoService } from './secret-crypto.service';
import { SecretMaskingService } from './secret-masking.service';
import { SecretReferenceResolverService } from './secret-reference-resolver.service';

describe('SecretReferenceResolverService', () => {
  const masking = new SecretMaskingService();

  it('finds secret references in YAML and execution plans', () => {
    const service = new SecretReferenceResolverService(
      {} as never,
      {} as SecretCryptoService,
      {} as SecretAuditService,
      masking,
    );

    expect(
      service.findReferencedKeys([
        'Authorization: Bearer {{ secret.API_KEY }}',
        { headers: { 'x-token': '{{ secret.SECOND_TOKEN }}' } },
        '{{ runtime }}',
      ]),
    ).toEqual(['API_KEY', 'SECOND_TOKEN']);
  });

  it('loads only referenced secrets and returns masking context', async () => {
    const prisma = {
      secret: {
        findMany: jest.fn(() =>
          Promise.resolve([
            {
              id: 'secret-1',
              key: 'API_KEY',
              projectId: 'project-1',
              encryptedValue: 'encrypted',
              encryptionKeyVersion: 'v2',
            },
          ]),
        ),
        updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
      },
    };
    const crypto = { decrypt: jest.fn(() => 'plain-secret') };
    const audit = { record: jest.fn(() => Promise.resolve()) };
    const service = new SecretReferenceResolverService(
      prisma as never,
      crypto as unknown as SecretCryptoService,
      audit as unknown as SecretAuditService,
      masking,
    );

    const context = await service.resolveForRun(
      'project-1',
      'company-1',
      'run-1',
      {
        compiledComposeYaml: 'API_KEY={{ secret.API_KEY }}',
        compiledRuntimeYaml: '',
        visualConfig: null,
      } as never,
      [],
    );

    expect(prisma.secret.findMany).toHaveBeenCalledWith({
      where: { projectId: 'project-1', key: { in: ['API_KEY'] } },
      orderBy: { key: 'asc' },
    });
    expect(context.secrets.get('API_KEY')).toBe('plain-secret');
    expect(context.masking.values).toEqual(['plain-secret']);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'secret.used_by_run', resourceId: 'secret-1' }),
    );
  });
});
