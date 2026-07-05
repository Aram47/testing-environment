import { VariableStoreService } from './variable-store.service';

describe('VariableStoreService', () => {
  const service = new VariableStoreService();

  it('interpolates variables in nested objects', () => {
    const store = new Map([['token', 'abc']]);
    expect(
      service.interpolate(
        { headers: { Authorization: 'Bearer {{ token }}' }, items: ['{{ token }}'] },
        store,
      ),
    ).toEqual({ headers: { Authorization: 'Bearer abc' }, items: ['abc'] });
  });

  it('keeps runtime variables and secrets in separate namespaces', () => {
    const store = new Map([['API_KEY', 'runtime-value']]);
    const secrets = new Map([['API_KEY', 'secret-value']]);

    expect(
      service.interpolate(
        { runtime: '{{ API_KEY }}', secret: '{{ secret.API_KEY }}' },
        store,
        secrets,
      ),
    ).toEqual({ runtime: 'runtime-value', secret: 'secret-value' });
  });
});
