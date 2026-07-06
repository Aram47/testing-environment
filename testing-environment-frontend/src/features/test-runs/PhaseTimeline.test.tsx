import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PhaseTimeline } from './PhaseTimeline';

describe('PhaseTimeline', () => {
  it('renders phase statuses', () => {
    render(
      <PhaseTimeline
        phases={[
          {
            id: 'queued',
            label: 'Queued',
            status: 'completed',
            durationMs: 1000,
          },
          {
            id: 'tests',
            label: 'Tests',
            status: 'failed',
            durationMs: 5000,
          },
        ]}
      />,
    );

    expect(screen.getByText('Queued')).toBeInTheDocument();
    expect(screen.getByText('Tests')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
  });
});
