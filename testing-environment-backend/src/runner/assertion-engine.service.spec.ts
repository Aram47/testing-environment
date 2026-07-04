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

  it('evaluates equals, contains, and exists assertions', () => {
    const payload = { user: { email: 'qa@example.com', name: 'QA Engineer' } };

    expect(service.evaluateAssertions(payload, [{ field_path: '$.user.email', operator: 'equals', expected_value: 'qa@example.com' }])).toEqual({
      passed: true,
    });
    expect(service.evaluateAssertions(payload, [{ field_path: '$.user.name', operator: 'contains', expected_value: 'Engineer' }])).toEqual({
      passed: true,
    });
    expect(service.evaluateAssertions(payload, [{ field_path: '$.user.email', operator: 'exists' }])).toEqual({ passed: true });
  });

  it('returns readable assertion failures', () => {
    const result = service.evaluateAssertions({ status: 'pending' }, [{ field_path: '$.status', operator: 'equals', expected_value: 'done' }]);

    expect(result.passed).toBe(false);
    expect(result.message).toContain('Expected $.status to equal');
  });
});
