import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFlowEditorState } from './hooks/useFlowEditorState';
import { createApiNode } from './lib/flowNodeFactory';
import type { FlowSuiteDefinition } from '../../../types';

const initialFlow: FlowSuiteDefinition = {
  version: '1.1',
  suiteName: 'Test',
  nodes: [createApiNode(1, { id: 'api-1', name: 'Health' })],
  edges: [],
};

describe('useFlowEditorState', () => {
  it('undoes added node', () => {
    const { result } = renderHook(() => useFlowEditorState('Test', initialFlow));

    act(() => {
      result.current.addNode(createApiNode(2, { id: 'api-2', name: 'Second' }));
    });
    expect(result.current.nodes).toHaveLength(2);

    act(() => {
      result.current.undo();
    });
    expect(result.current.nodes).toHaveLength(1);
  });

  it('duplicates selected nodes with new ids', () => {
    const { result } = renderHook(() => useFlowEditorState('Test', initialFlow));

    act(() => {
      result.current.selectNode('api-1');
      result.current.duplicateSelected();
    });

    expect(result.current.nodes).toHaveLength(2);
    expect(result.current.nodes[1].id).not.toBe('api-1');
  });

  it('deletes selected nodes', () => {
    const { result } = renderHook(() => useFlowEditorState('Test', initialFlow));

    act(() => {
      result.current.addNode(createApiNode(2, { id: 'api-2', name: 'Second' }));
    });
    act(() => {
      result.current.selectNode('api-2');
      result.current.deleteSelected();
    });

    expect(result.current.nodes).toHaveLength(1);
    expect(result.current.nodes[0]?.id).toBe('api-1');
  });
});
