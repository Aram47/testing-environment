import { useEffect, useMemo, useState } from 'react';
import {
  addEdge,
  applyNodeChanges,
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
} from '@xyflow/react';
import { CheckCircle2, FileCode2, Plus, Wand2 } from 'lucide-react';
import { testSuitesApi } from '../../api/test-suites.api';
import { Button } from '../../components/ui/Button';
import type { FlowApiNode, FlowSuiteDefinition } from '../../types';

type ApiNodeData = Record<string, unknown> & {
  api: FlowApiNode;
};

type ApiFlowNode = Node<ApiNodeData, 'apiCall'>;

const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

interface FlowSuiteEditorProps {
  projectId: string;
  suiteName: string;
  initialFlow?: FlowSuiteDefinition;
  initialYaml: string;
  onSave: (visualFlow: FlowSuiteDefinition) => void;
  onMessage: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

export function FlowSuiteEditor({ projectId, suiteName, initialFlow, initialYaml, onSave, onMessage }: FlowSuiteEditorProps) {
  const [nodes, setNodes] = useState<ApiFlowNode[]>(() => toReactNodes(initialFlow));
  const [edges, setEdges] = useState<Edge[]>(() => toReactEdges(initialFlow));
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(() => initialFlow?.nodes[0]?.id);
  const [yamlPreview, setYamlPreview] = useState(initialYaml);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isCompiling, setIsCompiling] = useState(false);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const nodeTypes = useMemo(() => ({ apiCall: ApiCallNode }), []);

  const buildFlow = (): FlowSuiteDefinition => ({
    version: '1.0',
    suiteName,
    nodes: nodes.map((node) => ({
      ...node.data.api,
      position: node.position,
    })),
    edges: edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
  });

  const addNode = () => {
    const id = `api-${Date.now()}`;
    const api: FlowApiNode = {
      id,
      position: { x: 120 + nodes.length * 48, y: 80 + nodes.length * 32 },
      name: `API call ${nodes.length + 1}`,
      method: 'GET',
      path: '/',
      expectStatus: 200,
    };
    setNodes((current) => [...current, toReactNode(api)]);
    setSelectedNodeId(id);
  };

  const updateSelectedNode = (nextApi: FlowApiNode) => {
    setNodes((current) =>
      current.map((node) =>
        node.id === nextApi.id
          ? {
              ...node,
              data: { api: nextApi },
              position: nextApi.position,
            }
          : node,
      ),
    );
  };

  const compileFlow = async () => {
    setIsCompiling(true);
    try {
      const result = await testSuitesApi.compileFlow(projectId, buildFlow());
      setYamlPreview(result.yamlContent);
      setWarnings(result.warnings);
      onMessage(result.warnings.length > 0 ? 'Flow compiled with warnings' : 'Flow is valid', result.warnings.length > 0 ? 'info' : 'success');
      return true;
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'Flow validation failed', 'error');
      return false;
    } finally {
      setIsCompiling(false);
    }
  };

  const save = async () => {
    if (await compileFlow()) {
      onSave(buildFlow());
    }
  };

  return (
    <section className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[180px_minmax(0,1fr)_360px]">
        <aside className="rounded-lg border border-border bg-white p-3 shadow-sm">
          <div className="space-y-2">
            <Button type="button" className="w-full justify-start" onClick={addNode}>
              <Plus size={16} /> Add API
            </Button>
            <Button type="button" variant="secondary" className="w-full justify-start" onClick={() => setNodes(autoLayout(nodes, edges))}>
              <Wand2 size={16} /> Auto layout
            </Button>
            <Button type="button" variant="secondary" className="w-full justify-start" disabled={isCompiling} onClick={compileFlow}>
              <CheckCircle2 size={16} /> {isCompiling ? 'Validating' : 'Validate'}
            </Button>
          </div>
        </aside>

        <div className="min-h-[520px] overflow-hidden rounded-lg border border-border bg-white shadow-sm">
          {nodes.length === 0 ? (
            <div className="flex h-[520px] flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-lg font-semibold text-ink">Create your first API call</p>
              <p className="max-w-sm text-sm text-muted">Connect calls to describe the order of a real user flow.</p>
              <Button type="button" onClick={addNode}>
                <Plus size={16} /> Add first API
              </Button>
            </div>
          ) : (
            <ReactFlow<ApiFlowNode, Edge>
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              fitView
              onNodeClick={(_event, node) => setSelectedNodeId(node.id)}
              onPaneClick={() => setSelectedNodeId(undefined)}
              onNodesChange={(changes) => {
                setNodes((current) => {
                  const nextNodes = applyFlowNodeChanges(changes, current);
                  const nodeIds = new Set(nextNodes.map((node) => node.id));
                  setEdges((currentEdges) => currentEdges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)));
                  if (selectedNodeId && !nodeIds.has(selectedNodeId)) {
                    setSelectedNodeId(undefined);
                  }
                  return nextNodes;
                });
              }}
              onEdgesChange={(changes) => {
                setEdges((current) => current.filter((edge) => !changes.some((change) => change.type === 'remove' && change.id === edge.id)));
              }}
              onConnect={(connection: Connection) => {
                setEdges((current) => addEdge({ ...connection, id: `edge-${connection.source}-${connection.target}-${Date.now()}` }, current));
              }}
            >
              <Background />
              <MiniMap pannable zoomable />
              <Controls />
            </ReactFlow>
          )}
        </div>

        <NodeInspector node={selectedNode?.data.api} onChange={updateSelectedNode} />
      </div>

      {warnings.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      <section className="rounded-lg border border-border bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink">Generated YAML preview</h2>
          <Button type="button" variant="secondary" disabled={isCompiling} onClick={compileFlow}>
            <FileCode2 size={16} /> Refresh preview
          </Button>
        </div>
        <pre className="max-h-80 overflow-auto rounded-md bg-slate-950 p-4 text-sm leading-6 text-slate-100">{yamlPreview || 'YAML preview will appear here.'}</pre>
      </section>

      <div className="flex justify-end">
        <Button type="button" disabled={isCompiling || nodes.length === 0} onClick={save}>
          Save flow
        </Button>
      </div>
    </section>
  );
}

function ApiCallNode({ data }: NodeProps<ApiFlowNode>) {
  const api = data.api;

  return (
    <article className="min-w-56 rounded-md border border-border bg-white px-3 py-2 text-left shadow-sm">
      <Handle type="target" position={Position.Left} />
      <p className="text-xs font-semibold uppercase text-brand">{api.method}</p>
      <h3 className="truncate text-sm font-semibold text-ink">{api.name}</h3>
      <p className="truncate text-xs text-muted">{api.path}</p>
      <Handle type="source" position={Position.Right} />
    </article>
  );
}

interface NodeInspectorProps {
  node?: FlowApiNode;
  onChange: (node: FlowApiNode) => void;
}

function NodeInspector({ node, onChange }: NodeInspectorProps) {
  if (!node) {
    return (
      <aside className="rounded-lg border border-border bg-white p-4 text-sm text-muted shadow-sm">
        Select a node to edit request details.
      </aside>
    );
  }

  const update = (changes: Partial<FlowApiNode>) => onChange({ ...node, ...changes });

  return (
    <aside className="space-y-4 rounded-lg border border-border bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-ink">API node</h2>
      <TextField label="Name" value={node.name} onChange={(name) => update({ name })} />
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">Method</span>
        <select className="input" value={node.method} onChange={(event) => update({ method: event.target.value })}>
          {methods.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>
      </label>
      <TextField label="Path" value={node.path} onChange={(path) => update({ path })} />
      <KeyValueField label="Headers" value={node.headers} onChange={(headers) => update({ headers })} />
      <KeyValueField label="Query params" value={node.query as Record<string, string> | undefined} onChange={(query) => update({ query })} />
      <JsonField label="JSON body" value={node.jsonBody} onChange={(jsonBody) => update({ jsonBody })} />
      <TextField
        label="Expected status"
        value={String(node.expectStatus ?? 200)}
        type="number"
        onChange={(value) => update({ expectStatus: Number(value) || 200 })}
      />
      <JsonField label="JSON contains" value={node.jsonContains} onChange={(jsonContains) => update({ jsonContains })} />
      <KeyValueField label="Save variables" value={node.save} placeholder="access_token=$.access_token" onChange={(save) => update({ save })} />
    </aside>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
}

function TextField({ label, value, type = 'text', onChange }: TextFieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      <input className="input" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

interface KeyValueFieldProps {
  label: string;
  value?: Record<string, string>;
  placeholder?: string;
  onChange: (value: Record<string, string> | undefined) => void;
}

function KeyValueField({ label, value, placeholder = 'Authorization=Bearer {{ access_token }}', onChange }: KeyValueFieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      <textarea
        className="input min-h-24 font-mono"
        spellCheck={false}
        placeholder={placeholder}
        value={formatKeyValue(value)}
        onChange={(event) => onChange(parseKeyValue(event.target.value))}
      />
    </label>
  );
}

interface JsonFieldProps {
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
}

function JsonField({ label, value, onChange }: JsonFieldProps) {
  const [text, setText] = useState(() => formatJson(value));
  const [error, setError] = useState('');

  useEffect(() => {
    setText(formatJson(value));
    setError('');
  }, [value]);

  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      <textarea
        className="input min-h-28 font-mono"
        spellCheck={false}
        placeholder={'{"id": 1}'}
        value={text}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          if (!next.trim()) {
            setError('');
            onChange(undefined);
            return;
          }
          try {
            onChange(JSON.parse(next));
            setError('');
          } catch {
            setError('Invalid JSON');
          }
        }}
      />
      {error ? <span className="mt-1 block text-xs font-medium text-red-600">{error}</span> : null}
    </label>
  );
}

function toReactNodes(flow?: FlowSuiteDefinition): ApiFlowNode[] {
  return (flow?.nodes ?? []).map(toReactNode);
}

function toReactNode(api: FlowApiNode): ApiFlowNode {
  return {
    id: api.id,
    type: 'apiCall',
    position: api.position,
    data: { api },
  };
}

function toReactEdges(flow?: FlowSuiteDefinition): Edge[] {
  return (flow?.edges ?? []).map((edge) => ({ id: edge.id, source: edge.source, target: edge.target }));
}

function applyFlowNodeChanges(changes: NodeChange<ApiFlowNode>[], nodes: ApiFlowNode[]): ApiFlowNode[] {
  return applyNodeChanges(changes, nodes).map((node) => ({
    ...node,
    data: {
      api: {
        ...node.data.api,
        position: node.position,
      },
    },
  }));
}

function autoLayout(nodes: ApiFlowNode[], edges: Edge[]): ApiFlowNode[] {
  const targets = new Set(edges.map((edge) => edge.target));
  const orderedIds = [...nodes.filter((node) => !targets.has(node.id)).map((node) => node.id), ...nodes.map((node) => node.id)];
  const uniqueIds = [...new Set(orderedIds)];
  return nodes.map((node) => {
    const index = uniqueIds.indexOf(node.id);
    const position = { x: 80 + index * 260, y: 120 };
    return { ...node, position, data: { api: { ...node.data.api, position } } };
  });
}

function formatKeyValue(value?: Record<string, string>): string {
  return Object.entries(value ?? {})
    .map(([key, entryValue]) => `${key}=${entryValue}`)
    .join('\n');
}

function parseKeyValue(value: string): Record<string, string> | undefined {
  const entries = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf('=');
      return separator === -1 ? [line, ''] : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    })
    .filter(([key]) => key);

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function formatJson(value: unknown): string {
  return value === undefined ? '' : JSON.stringify(value, null, 2);
}
