import { useCallback, useMemo, useRef, useState } from 'react';
import { addEdge, type Connection, type Edge, type NodeChange } from '@xyflow/react';
import type { FlowNode, FlowSuiteDefinition } from '../../../../types';
import { duplicateNodes, pasteClipboard, readClipboard } from '../lib/flowClipboard';
import { canConnectLinear } from '../lib/flowGraph';
import { autoLayout } from '../lib/flowLayout';
import { createNodeFromTemplate } from '../lib/flowNodeFactory';
import type { NodeTemplateId } from '../types';
import {
  applyFlowNodeChanges,
  buildFlowDefinition,
  toReactEdges,
  toReactNode,
  toReactNodes,
} from '../lib/flowSerialization';
import { serializeFlowForCompare } from '../lib/flowGraph';
import type { FlowEditorNode, FlowEditorSnapshot } from '../types';

const HISTORY_LIMIT = 50;

function cloneSnapshot(snapshot: FlowEditorSnapshot): FlowEditorSnapshot {
  return {
    nodes: snapshot.nodes.map((node) => ({
      ...node,
      position: { ...node.position },
      data: { ...node.data, flowNode: { ...node.data.flowNode, position: { ...node.data.flowNode.position } } },
    })),
    edges: snapshot.edges.map((edge) => ({ ...edge })),
  };
}

export function useFlowEditorState(suiteName: string, initialFlow?: FlowSuiteDefinition) {
  const initialSnapshot = useMemo<FlowEditorSnapshot>(
    () => ({
      nodes: toReactNodes(initialFlow),
      edges: toReactEdges(initialFlow),
    }),
    [initialFlow],
  );

  const [nodes, setNodes] = useState<FlowEditorNode[]>(initialSnapshot.nodes);
  const [edges, setEdges] = useState<Edge[]>(initialSnapshot.edges);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>(() =>
    initialSnapshot.nodes[0] ? [initialSnapshot.nodes[0].id] : [],
  );

  const historyRef = useRef<FlowEditorSnapshot[]>([cloneSnapshot(initialSnapshot)]);
  const historyIndexRef = useRef(0);
  const skipHistoryRef = useRef(false);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncHistoryFlags = useCallback(() => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, []);

  const commitSnapshot = useCallback(
    (nextNodes: FlowEditorNode[], nextEdges: Edge[]) => {
      if (skipHistoryRef.current) {
        skipHistoryRef.current = false;
        return;
      }
      const snapshot = cloneSnapshot({ nodes: nextNodes, edges: nextEdges });
      const truncated = historyRef.current.slice(0, historyIndexRef.current + 1);
      truncated.push(snapshot);
      if (truncated.length > HISTORY_LIMIT) {
        truncated.shift();
      }
      historyRef.current = truncated;
      historyIndexRef.current = truncated.length - 1;
      syncHistoryFlags();
    },
    [syncHistoryFlags],
  );

  const applySnapshot = useCallback(
    (snapshot: FlowEditorSnapshot) => {
      skipHistoryRef.current = true;
      setNodes(snapshot.nodes);
      setEdges(snapshot.edges);
      setSelectedNodeIds((current) => current.filter((id) => snapshot.nodes.some((node) => node.id === id)));
      syncHistoryFlags();
    },
    [syncHistoryFlags],
  );

  const buildFlow = useCallback(
    () => buildFlowDefinition(suiteName, nodes, edges),
    [suiteName, nodes, edges],
  );

  const isDirty = useMemo(() => {
    const initial = buildFlowDefinition(suiteName, initialSnapshot.nodes, initialSnapshot.edges);
    const current = buildFlowDefinition(suiteName, nodes, edges);
    return serializeFlowForCompare(initial) !== serializeFlowForCompare(current);
  }, [suiteName, initialSnapshot, nodes, edges]);

  const setStateWithHistory = useCallback(
    (nextNodes: FlowEditorNode[], nextEdges: Edge[]) => {
      setNodes(nextNodes);
      setEdges(nextEdges);
      commitSnapshot(nextNodes, nextEdges);
    },
    [commitSnapshot],
  );

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) {
      return;
    }
    historyIndexRef.current -= 1;
    applySnapshot(historyRef.current[historyIndexRef.current]);
  }, [applySnapshot]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) {
      return;
    }
    historyIndexRef.current += 1;
    applySnapshot(historyRef.current[historyIndexRef.current]);
  }, [applySnapshot]);

  const selectNode = useCallback((nodeId: string | undefined, additive = false) => {
    if (!nodeId) {
      setSelectedNodeIds([]);
      return;
    }
    setSelectedNodeIds((current) => {
      if (additive) {
        return current.includes(nodeId) ? current.filter((id) => id !== nodeId) : [...current, nodeId];
      }
      return [nodeId];
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedNodeIds(nodes.map((node) => node.id));
  }, [nodes]);

  const addNode = useCallback(
    (flowNode: FlowNode) => {
      const nextNodes = [...nodes, toReactNode(flowNode)];
      let nextEdges = edges;
      if (nodes.length > 0) {
        const lastNode = nodes[nodes.length - 1];
        nextEdges = addEdge(
          {
            id: `edge-${lastNode.id}-${flowNode.id}-${Date.now()}`,
            source: lastNode.id,
            target: flowNode.id,
          },
          edges,
        );
      }
      setStateWithHistory(nextNodes, nextEdges);
      setSelectedNodeIds([flowNode.id]);
    },
    [nodes, edges, setStateWithHistory],
  );

  const addTemplate = useCallback(
    (templateId: NodeTemplateId) => {
      addNode(createNodeFromTemplate(templateId, nodes.length + 1));
    },
    [addNode, nodes.length],
  );

  const updateNode = useCallback(
    (nextNode: FlowNode) => {
      const nextNodes = nodes.map((node) =>
        node.id === nextNode.id
          ? {
              ...node,
              data: { ...node.data, flowNode: nextNode },
              position: nextNode.position,
            }
          : node,
      );
      setStateWithHistory(nextNodes, edges);
    },
    [nodes, edges, setStateWithHistory],
  );

  const deleteSelected = useCallback(() => {
    const selected = new Set(selectedNodeIds);
    const nextNodes = nodes.filter((node) => !selected.has(node.id));
    const nextEdges = edges.filter((edge) => !selected.has(edge.source) && !selected.has(edge.target));
    setStateWithHistory(nextNodes, nextEdges);
    setSelectedNodeIds([]);
  }, [selectedNodeIds, nodes, edges, setStateWithHistory]);

  const duplicateSelected = useCallback(() => {
    if (selectedNodeIds.length === 0) {
      return;
    }
    const result = duplicateNodes(nodes, edges, selectedNodeIds);
    setStateWithHistory(result.nodes, [...edges, ...result.edges]);
    setSelectedNodeIds(result.newIds);
  }, [selectedNodeIds, nodes, edges, setStateWithHistory]);

  const paste = useCallback(() => {
    const payload = readClipboard();
    if (!payload || payload.nodes.length === 0) {
      return;
    }
    const result = pasteClipboard(payload, nodes);
    setStateWithHistory(result.nodes, [...edges, ...result.edges]);
    setSelectedNodeIds(result.nodes.slice(nodes.length).map((node) => node.id));
  }, [nodes, edges, setStateWithHistory]);

  const runAutoLayout = useCallback(() => {
    const nextNodes = autoLayout(nodes, edges);
    setStateWithHistory(nextNodes, edges);
  }, [nodes, edges, setStateWithHistory]);

  const onNodesChange = useCallback(
    (changes: NodeChange<FlowEditorNode>[]) => {
      const hasStructural = changes.some((change) => change.type === 'remove' || change.type === 'add');
      const nextNodes = applyFlowNodeChanges(changes, nodes);
      let nextEdges = edges;
      if (hasStructural) {
        const nodeIds = new Set(nextNodes.map((node) => node.id));
        nextEdges = edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));
        setSelectedNodeIds((current) => current.filter((id) => nodeIds.has(id)));
      }
      if (hasStructural) {
        setStateWithHistory(nextNodes, nextEdges);
      } else {
        setNodes(nextNodes);
      }
    },
    [nodes, edges, setStateWithHistory],
  );

  const onNodeDragStop = useCallback(() => {
    commitSnapshot(nodes, edges);
  }, [nodes, edges, commitSnapshot]);

  const onEdgesChange = useCallback(
    (changes: Array<{ type: string; id?: string }>) => {
      const nextEdges = edges.filter((edge) => !changes.some((change) => change.type === 'remove' && change.id === edge.id));
      setStateWithHistory(nodes, nextEdges);
    },
    [nodes, edges, setStateWithHistory],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) {
        return;
      }
      if (!canConnectLinear(connection.source, connection.target, edges)) {
        return;
      }
      const nextEdges = addEdge(
        { ...connection, id: `edge-${connection.source}-${connection.target}-${Date.now()}` },
        edges,
      );
      setStateWithHistory(nodes, nextEdges);
    },
    [nodes, edges, setStateWithHistory],
  );

  const restoreSnapshot = useCallback(
    (flow: FlowSuiteDefinition) => {
      const snapshot = { nodes: toReactNodes(flow), edges: toReactEdges(flow) };
      historyRef.current = [cloneSnapshot(snapshot)];
      historyIndexRef.current = 0;
      applySnapshot(snapshot);
      setCanUndo(false);
      setCanRedo(false);
    },
    [applySnapshot],
  );

  const selectedNodeId = selectedNodeIds[0];
  const selectedNode = nodes.find((node) => node.id === selectedNodeId);

  return {
    nodes,
    edges,
    selectedNodeIds,
    selectedNodeId,
    selectedNode,
    canUndo,
    canRedo,
    isDirty,
    buildFlow,
    addNode,
    addTemplate,
    updateNode,
    deleteSelected,
    duplicateSelected,
    paste,
    undo,
    redo,
    selectNode,
    selectAll,
    setSelectedNodeIds,
    runAutoLayout,
    onNodesChange,
    onNodeDragStop,
    onEdgesChange,
    onConnect,
    restoreSnapshot,
  };
}
