import { useMemo } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type NodeMouseHandler,
  type NodeTypes,
  type OnEdgesChange,
  type OnNodesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { FlowEditorNode } from './types';
import { FlowStepNode } from './FlowStepNode';

interface FlowCanvasProps {
  nodes: FlowEditorNode[];
  edges: Edge[];
  readOnly?: boolean;
  onNodesChange: OnNodesChange<FlowEditorNode>;
  onNodeDragStop?: () => void;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  onNodeClick: NodeMouseHandler<FlowEditorNode>;
  onPaneClick: () => void;
  onSelectionChange: (ids: string[]) => void;
}

function FlowCanvasInner({
  nodes,
  edges,
  readOnly = false,
  onNodesChange,
  onNodeDragStop,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onPaneClick,
  onSelectionChange,
}: FlowCanvasProps) {
  const nodeTypes = useMemo<NodeTypes>(() => ({ flowStep: FlowStepNode as NodeTypes[string] }), []);

  return (
    <ReactFlow<FlowEditorNode, Edge>
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      nodesDraggable={!readOnly}
      nodesConnectable={!readOnly}
      elementsSelectable
      nodesFocusable
      selectionOnDrag
      multiSelectionKeyCode="Shift"
      deleteKeyCode={null}
      aria-label="Flow canvas"
      onNodesChange={onNodesChange}
      onNodeDragStop={onNodeDragStop}
      onEdgesChange={onEdgesChange}
      onConnect={readOnly ? undefined : onConnect}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      onSelectionChange={({ nodes: selectedNodes }) => onSelectionChange(selectedNodes.map((node) => node.id))}
    >
      <Background />
      <MiniMap pannable zoomable aria-label="Flow minimap" />
      <Controls aria-label="Flow canvas controls" />
    </ReactFlow>
  );
}

export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
