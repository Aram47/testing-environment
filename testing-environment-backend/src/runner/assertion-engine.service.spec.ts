import { AssertionEngineService } from './assertion-engine.service';

describe('AssertionEngineService', () => {
  const service = new AssertionEngineService();

  it('checks nested json containment', () => {
    expect(
      service.contains(
        { user: { id: '1', email: 'test@example.com' }, ignored: true },
        { user: { email: 'test@example.com' } },
      ),
    ).toBe(true);
  });

  it('reads simple json path values', () => {
    expect(service.readJsonPath({ access_token: 'abc' }, '$.access_token')).toBe('abc');
  });
});
