import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StructuredDiagnosisPanel } from './StructuredDiagnosisPanel';

describe('StructuredDiagnosisPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders evidence, actions, and does not expose raw secrets', () => {
    render(
      <StructuredDiagnosisPanel
        diagnosis={{
          category: 'unexpected_status',
          title: 'Unexpected HTTP status code',
          summary: 'Suite / Create user: Expected status 201, got 500',
          confidence: 0.95,
          primaryEvidence: [
            {
              type: 'test_result',
              label: 'Failed step',
              detail: 'Expected status 201, got 500',
              ref: { testResultId: 'result-1' },
            },
            {
              type: 'run_field',
              label: 'Authorization header',
              detail: 'authorization="***"',
              ref: { field: 'errorMessage' },
            },
          ],
          relatedEvidence: [],
          suggestedActions: [
            {
              id: 'compare-response',
              label: 'Compare response with baseline',
              description: 'Open the failed step response preview.',
              priority: 'high',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('Structured diagnosis')).toBeInTheDocument();
    expect(screen.getByText('Unexpected HTTP status code')).toBeInTheDocument();
    expect(screen.getByText(/Compare response with baseline/)).toBeInTheDocument();
    expect(screen.queryByText(/super-secret-token/)).not.toBeInTheDocument();
    expect(screen.getByText('authorization="***"')).toBeInTheDocument();
  });

  it('selects test result from evidence ref', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <StructuredDiagnosisPanel
        diagnosis={{
          category: 'assertion_mismatch',
          title: 'Assertion mismatch',
          summary: 'Field mismatch',
          confidence: 0.95,
          primaryEvidence: [
            {
              type: 'test_result',
              label: 'Failed step',
              detail: 'Expected user-1',
              ref: { testResultId: 'result-42' },
            },
          ],
          relatedEvidence: [],
          suggestedActions: [],
        }}
        onSelectTestResult={onSelect}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Expected user-1/i }));
    expect(onSelect).toHaveBeenCalledWith('result-42');
  });
});
