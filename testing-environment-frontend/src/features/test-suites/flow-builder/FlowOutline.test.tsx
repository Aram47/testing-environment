import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FlowOutline } from './FlowOutline';
import { validateFlow } from './lib/flowValidation';
import { createApiNode } from './lib/flowNodeFactory';
import { toReactNode } from './lib/flowSerialization';
import type { FlowSuiteDefinition } from '../../../types';

vi.mock('@xyflow/react', () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => children,
  ReactFlow: () => <div data-testid="react-flow-mock" />,
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  Handle: () => null,
  Position: { Left: 'left', Right: 'right' },
  applyNodeChanges: (changes: unknown[], nodes: unknown[]) => nodes,
  addEdge: (edge: unknown, edges: unknown[]) => [...edges, edge],
}));

describe('FlowOutline', () => {
  it('renders steps and selects on click', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const node = toReactNode(createApiNode(1, { id: 'api-1', name: 'Health check' }));

    render(
      <FlowOutline
        nodes={[node]}
        edges={[]}
        selectedNodeIds={[]}
        issues={[]}
        searchQuery=""
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Health check/i }));
    expect(onSelect).toHaveBeenCalledWith('api-1');
  });
});

describe('validateFlow integration', () => {
  it('returns field issue for empty name', () => {
    const flow: FlowSuiteDefinition = {
      version: '1.1',
      suiteName: 'Test',
      nodes: [createApiNode(1, { id: 'api-1', name: '   ' })],
      edges: [],
    };
    const issues = validateFlow(flow);
    expect(issues[0]).toMatchObject({ nodeId: 'api-1', field: 'name' });
  });
});
