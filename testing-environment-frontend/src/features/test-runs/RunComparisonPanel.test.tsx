import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { RunComparisonPanel } from './RunComparisonPanel';

describe('RunComparisonPanel', () => {
  it('highlights revision and timing regression changes', () => {
    render(
      <MemoryRouter>
        <RunComparisonPanel
          projectId="project-1"
          comparison={{
            baselineRun: { id: 'run-1', status: 'PASSED', finishedAt: '2026-07-06T10:00:00.000Z' },
            currentRun: { id: 'run-2', status: 'TEST_FAILED', finishedAt: '2026-07-06T11:00:00.000Z' },
            revisions: {
              environment: { current: { revisionNumber: 2 }, baseline: { revisionNumber: 1 }, changed: true },
              suites: [
                {
                  suiteName: 'Suite A',
                  currentRevisionNumber: 3,
                  baselineRevisionNumber: 2,
                  changed: true,
                },
              ],
            },
            imageReferences: [
              { serviceName: 'api', current: 'node:22', baseline: 'node:20', changed: true },
            ],
            stepDiffs: [
              {
                stepId: 'step-1',
                testName: 'Create user',
                currentStatus: 'FAILED',
                baselineStatus: 'PASSED',
                statusChanged: true,
                currentDurationMs: 250,
                baselineDurationMs: 100,
                durationRegressionPercent: 150,
              },
            ],
            summary: { stepsWithStatusChange: 1, stepsWithTimingRegression: 1 },
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Comparison with last successful run')).toBeInTheDocument();
    expect(screen.getAllByText('Changed').length).toBeGreaterThan(0);
    expect(screen.getByText('Create user')).toBeInTheDocument();
  });
});
