import { AuditSanitizerService } from './audit-sanitizer.service';

describe('AuditSanitizerService', () => {
  const sanitizer = new AuditSanitizerService();

  it('redacts secrets recursively', () => {
    expect(
      sanitizer.sanitize({
        token: 'raw-token',
        nested: { password: 'secret', safe: 'value' },
        items: [{ encryptedValue: 'ciphertext' }],
      }),
    ).toEqual({
      token: '[REDACTED]',
      nested: { password: '[REDACTED]', safe: 'value' },
      items: [{ encryptedValue: '[REDACTED]' }],
    });
  });
});
