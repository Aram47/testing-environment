import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { NodeProps } from '@xyflow/react';
import { FlowStepNode } from './FlowStepNode';
import { toReactNode } from './lib/flowSerialization';
import { createApiNode } from './lib/flowNodeFactory';
import type { FlowEditorNode } from './types';

vi.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: { Left: 'left', Right: 'right' },
}));

function renderNode(data: FlowEditorNode['data']) {
  const props = {
    id: 'api-1',
    type: 'flowStep',
    data,
    selected: false,
  } as NodeProps<FlowEditorNode>;
  render(<FlowStepNode {...props} />);
}

describe('FlowStepNode', () => {
  it('shows validation error badge', () => {
    const node = toReactNode(createApiNode(1, { id: 'api-1', name: 'Broken' }));
    node.data.validationStatus = 'error';
    renderNode(node.data);
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('shows execution result when provided', () => {
    const node = toReactNode(createApiNode(1, { id: 'api-1', name: 'Health' }));
    node.data.executionResult = {
      id: 'result-1',
      status: 'PASSED',
      suiteName: 'Suite',
      testName: 'Health',
      method: 'GET',
      path: '/health',
      expectedStatus: 200,
      durationMs: 120,
    };
    renderNode(node.data);
    expect(screen.getByText(/PASSED/i)).toBeInTheDocument();
  });
});
