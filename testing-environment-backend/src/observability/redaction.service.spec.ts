import { RedactionService } from './redaction.service';

describe('RedactionService', () => {
  it('redacts secret-like keys recursively and bearer/basic credentials in strings', () => {
    const service = new RedactionService();

    expect(
      service.redact({
        authorization: 'Bearer abc.def',
        nested: {
          password: 'secret',
          message: 'call with Bearer abc.def and Basic dXNlcjpwYXNz',
        },
      }),
    ).toEqual({
      authorization: '[REDACTED]',
      nested: {
        password: '[REDACTED]',
        message: 'call with Bearer [REDACTED] and Basic [REDACTED]',
      },
    });
  });
});
