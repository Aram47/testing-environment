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
});
