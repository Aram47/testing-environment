import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FailureInspector } from './FailureInspector';

describe('FailureInspector', () => {
  it('renders primary failure assertions and masked variables', () => {
    render(
      <FailureInspector
        diagnosis={{
          failureCategory: 'TEST_ASSERTION',
          headline: 'Expected status 201, got 500',
          primaryFailure: {
            kind: 'test_step',
            phase: 'tests',
            testResultId: 'result-1',
            message: 'Expected status 201, got 500',
            assertions: [
              {
                fieldPath: '$.status',
                operator: 'equals',
                expected: 201,
                actual: 500,
                passed: false,
                message: 'Expected status 201, got 500',
              },
            ],
          },
          environmentResult: { status: 'passed' },
          healthcheckResult: { status: 'passed' },
          infrastructure: {},
        }}
        result={{
          id: 'result-1',
          status: 'FAILED',
          suiteName: 'Suite',
          testName: 'Create user',
          method: 'POST',
          path: '/users',
          expectedStatus: 201,
          actualStatus: 500,
          variablesSnapshot: { token: '***' },
        }}
      />,
    );

    expect(screen.getByText('Primary failure')).toBeInTheDocument();
    expect(screen.getAllByText('Expected status 201, got 500').length).toBeGreaterThan(0);
    expect(screen.getByText('Assertions')).toBeInTheDocument();
    expect(screen.getByText('Variables at failure')).toBeInTheDocument();
  });
});
