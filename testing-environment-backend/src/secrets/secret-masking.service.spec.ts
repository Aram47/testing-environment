import { SecretMaskingService } from './secret-masking.service';

describe('SecretMaskingService', () => {
  const service = new SecretMaskingService();

  it('masks exact values, authorization headers, token patterns, and query params', () => {
    const context = service.createContext(['super-secret-token']);

    expect(service.maskString('value=super-secret-token', context)).toBe('value=[SECRET]');
    expect(service.maskString('Authorization: Bearer abcdefghijk', context)).toBe(
      'Authorization: Bearer [SECRET]',
    );
    expect(service.maskString('access_token=abcdefghijk', context)).toBe('access_token=[SECRET]');
    expect(service.maskString('/callback?api_key=abcdefghijk&ok=1', context)).toBe(
      '/callback?api_key=[SECRET]&ok=1',
    );
  });

  it('masks sensitive object fields recursively', () => {
    const context = service.createContext(['super-secret-token']);

    expect(
      service.maskValue(
        { headers: { Authorization: 'Bearer super-secret-token' }, body: ['super-secret-token'] },
        context,
      ),
    ).toEqual({ headers: { Authorization: '[SECRET]' }, body: ['[SECRET]'] });
  });
});
