import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RevisionDiffViewer } from './RevisionDiffViewer';

describe('RevisionDiffViewer', () => {
  it('renders changed lines', () => {
    render(
      <RevisionDiffViewer
        title="Compose diff"
        composeDiff={[{ line: 1, from: 'old', to: 'new', changed: true }]}
        runtimeDiff={[]}
      />,
    );

    expect(screen.getByText('Compose diff')).toBeInTheDocument();
    expect(screen.getByText('old')).toBeInTheDocument();
    expect(screen.getByText('new')).toBeInTheDocument();
  });
});
