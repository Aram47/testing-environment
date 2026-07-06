import { useEffect, useMemo, useState } from 'react';
import '@xyflow/react/dist/style.css';
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
import { CheckCircle2, Clock3, Copy, FileCode2, Plus, SearchCheck, Trash2, Variable, Wand2 } from 'lucide-react';
import { testSuitesApi } from '../../api/test-suites.api';
import { Button } from '../../components/ui/Button';
import type {
  FlowApiNode,
  FlowAssertNode,
  FlowAssertion,
  FlowAssertionOperator,
  FlowNode,
  FlowPollUntilNode,
  FlowRetryPolicy,
  FlowSetVariableNode,
  FlowSuiteDefinition,
  FlowWaitNode,
} from '../../types';

type FlowNodeData = Record<string, unknown> & {
  flowNode: FlowNode;
};

type FlowEditorNode = Node<FlowNodeData, 'flowStep'>;

type RequestFieldChanges = Partial<Pick<FlowApiNode, 'method' | 'path' | 'headers' | 'query' | 'jsonBody' | 'expectStatus' | 'assertions' | 'save'>>;

const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const assertionOperators: FlowAssertionOperator[] = ['equals', 'contains', 'exists'];
const defaultRetryPolicy: FlowRetryPolicy = { maxAttempts: 1, backoffMs: 0 };

interface FlowSuiteEditorProps {
  projectId: string;
  suiteName: string;
  initialFlow?: FlowSuiteDefinition;
  initialYaml: string;
  onSave: (visualFlow: FlowSuiteDefinition) => void;
  onMessage: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

export function FlowSuiteEditor({ projectId, suiteName, initialFlow, initialYaml, onSave, onMessage }: FlowSuiteEditorProps) {
  const [nodes, setNodes] = useState<FlowEditorNode[]>(() => toReactNodes(initialFlow));
  const [edges, setEdges] = useState<Edge[]>(() => toReactEdges(initialFlow));
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(() => initialFlow?.nodes[0]?.id);
  const [yamlPreview, setYamlPreview] = useState(initialYaml);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [isCompiling, setIsCompiling] = useState(false);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const nodeTypes = useMemo(() => ({ flowStep: FlowStepNode }), []);
  const variables = useMemo(() => collectVariables(nodes), [nodes]);

  const buildFlow = (): FlowSuiteDefinition => ({
    version: '1.1',
    suiteName,
    nodes: nodes.map((node) => ({
      ...node.data.flowNode,
      position: node.position,
    })),
    edges: edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
  });

  const addApiNode = () => addNode(createApiNode(nodes.length + 1));
  const addWaitNode = () => addNode(createWaitNode(nodes.length + 1));
  const addPollNode = () => addNode(createPollNode(nodes.length + 1));
  const addSetVariableNode = () => addNode(createSetVariableNode(nodes.length + 1));
  const addAssertNode = () => addNode(createAssertNode(nodes.length + 1));

  const addNode = (flowNode: FlowNode) => {
    setNodes((current) => [...current, toReactNode(flowNode)]);
    setSelectedNodeId(flowNode.id);
  };

  const updateSelectedNode = (nextNode: FlowNode) => {
    setNodes((current) =>
      current.map((node) =>
        node.id === nextNode.id
          ? {
              ...node,
              data: { flowNode: nextNode },
              position: nextNode.position,
            }
          : node,
      ),
    );
  };

  const compileFlow = async () => {
    const validationErrors = validateFlow(buildFlow());
    setFieldErrors(validationErrors);
    if (validationErrors.length > 0) {
      onMessage(validationErrors[0], 'error');
      return false;
    }

    setIsCompiling(true);
    try {
      const result = await testSuitesApi.compileFlow(projectId, buildFlow());
      setYamlPreview(result.yamlContent);
      setWarnings(result.warnings);
      onMessage(result.warnings.length > 0 ? 'Flow compiled with warnings' : 'Flow is valid', result.warnings.length > 0 ? 'info' : 'success');
      return true;
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'Flow validation failed. Check highlighted fields and try again.', 'error');
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
      <div className="grid gap-4 xl:grid-cols-[190px_minmax(0,1fr)_380px]">
        <aside className="rounded-lg border border-border bg-white p-3 shadow-sm">
          <div className="space-y-2">
            <Button type="button" className="w-full justify-start" onClick={addApiNode}>
              <Plus size={16} /> Add API
            </Button>
            <Button type="button" variant="secondary" className="w-full justify-start" onClick={addWaitNode}>
              <Clock3 size={16} /> Add Wait
            </Button>
            <Button type="button" variant="secondary" className="w-full justify-start" onClick={addPollNode}>
              <SearchCheck size={16} /> Add Poll
            </Button>
            <Button type="button" variant="secondary" className="w-full justify-start" onClick={addSetVariableNode}>
              <Variable size={16} /> Set Variable
            </Button>
            <Button type="button" variant="secondary" className="w-full justify-start" onClick={addAssertNode}>
              <CheckCircle2 size={16} /> Add Assert
            </Button>
            <Button type="button" variant="secondary" className="w-full justify-start" onClick={() => setNodes(autoLayout(nodes, edges))}>
              <Wand2 size={16} /> Auto layout
            </Button>
            <Button type="button" variant="secondary" className="w-full justify-start" disabled={isCompiling} onClick={compileFlow}>
              <CheckCircle2 size={16} /> {isCompiling ? 'Validating' : 'Validate'}
            </Button>
          </div>
        </aside>

        <div className="min-h-[540px] overflow-hidden rounded-lg border border-border bg-white shadow-sm">
          {nodes.length === 0 ? (
            <div className="flex h-[540px] flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-lg font-semibold text-ink">Create your first flow step</p>
              <p className="max-w-sm text-sm text-muted">Combine API requests, waits, and polling to describe a real backend flow.</p>
              <Button type="button" onClick={addApiNode}>
                <Plus size={16} /> Add first API
              </Button>
            </div>
          ) : (
            <ReactFlow<FlowEditorNode, Edge>
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

        <NodeInspector node={selectedNode?.data.flowNode} variables={variables} errors={fieldErrors} onChange={updateSelectedNode} />
      </div>

      {[...fieldErrors, ...warnings].length > 0 ? (
        <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {[...fieldErrors, ...warnings].map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      <section className="rounded-lg border border-border bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink">YAML export preview</h2>
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

function FlowStepNode({ data }: NodeProps<FlowEditorNode>) {
  const node = data.flowNode;
  const typeLabel = stepTypeLabel(node);

  return (
    <article className="min-w-60 rounded-md border border-border bg-white px-3 py-2 text-left shadow-sm">
      <Handle type="target" position={Position.Left} />
      <p className="text-xs font-semibold uppercase text-brand">{typeLabel}</p>
      <h3 className="truncate text-sm font-semibold text-ink">{node.name}</h3>
      <p className="truncate text-xs text-muted">{stepSummary(node)}</p>
      <Handle type="source" position={Position.Right} />
    </article>
  );
}

interface NodeInspectorProps {
  node?: FlowNode;
  variables: string[];
  errors: string[];
  onChange: (node: FlowNode) => void;
}

function NodeInspector({ node, variables, errors, onChange }: NodeInspectorProps) {
  if (!node) {
    return (
      <aside className="rounded-lg border border-border bg-white p-4 text-sm text-muted shadow-sm">
        Select a step to edit details.
      </aside>
    );
  }

  return (
    <aside className="max-h-[760px] space-y-4 overflow-y-auto rounded-lg border border-border bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-ink">{stepTypeLabel(node)} step</h2>
        <FieldErrors errors={errors.filter((error) => error.includes(`"${node.name}"`) || error.includes(node.id))} />
      </div>
      {isWaitNode(node) ? (
        <WaitInspector node={node} onChange={onChange} />
      ) : isPollNode(node) ? (
        <PollInspector node={node} variables={variables} onChange={onChange} />
      ) : isSetVariableNode(node) ? (
        <SetVariableInspector node={node} variables={variables} onChange={onChange} />
      ) : isAssertNode(node) ? (
        <AssertInspector node={node} variables={variables} onChange={onChange} />
      ) : (
        <ApiInspector node={node} variables={variables} onChange={onChange} />
      )}
    </aside>
  );
}

function ApiInspector({ node, variables, onChange }: { node: FlowApiNode; variables: string[]; onChange: (node: FlowNode) => void }) {
  const update = (changes: Partial<FlowApiNode>) => onChange({ ...node, ...changes });

  return (
    <>
      <TextField label="Name" value={node.name} onChange={(name) => update({ name })} />
      <ExecutionFields node={node} onChange={update} />
      <RequestFields node={node} variables={variables} onChange={update} />
    </>
  );
}

function PollInspector({ node, variables, onChange }: { node: FlowPollUntilNode; variables: string[]; onChange: (node: FlowNode) => void }) {
  const update = (changes: Partial<FlowPollUntilNode>) => onChange({ ...node, ...changes });

  return (
    <>
      <TextField label="Name" value={node.name} onChange={(name) => update({ name })} />
      <ExecutionFields node={node} onChange={update} />
      <RequestFields node={node} variables={variables} onChange={update} />
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField label="Timeout seconds" value={node.timeoutSeconds} onChange={(timeoutSeconds) => update({ timeoutSeconds })} />
        <NumberField label="Retry interval seconds" value={node.intervalSeconds} onChange={(intervalSeconds) => update({ intervalSeconds })} />
      </div>
      <TextField label="Failure message" value={node.failureMessage ?? ''} onChange={(failureMessage) => update({ failureMessage })} />
    </>
  );
}

function WaitInspector({ node, onChange }: { node: FlowWaitNode; onChange: (node: FlowNode) => void }) {
  const update = (changes: Partial<FlowWaitNode>) => onChange({ ...node, ...changes });

  return (
    <>
      <TextField label="Name" value={node.name} onChange={(name) => update({ name })} />
      <ExecutionFields node={node} onChange={update} />
      <NumberField label="Duration milliseconds" value={node.durationMs} onChange={(durationMs) => update({ durationMs })} />
    </>
  );
}

function SetVariableInspector({
  node,
  variables,
  onChange,
}: {
  node: FlowSetVariableNode;
  variables: string[];
  onChange: (node: FlowNode) => void;
}) {
  const update = (changes: Partial<FlowSetVariableNode>) => onChange({ ...node, ...changes });

  return (
    <>
      <TextField label="Name" value={node.name} onChange={(name) => update({ name })} />
      <ExecutionFields node={node} onChange={update} />
      <TextField label="Variable name" value={node.variableName} onChange={(variableName) => update({ variableName })} />
      <TextField label="Value" value={node.value ?? ''} onChange={(value) => update({ value })} />
      <VariablePicker variables={variables} />
      <TextField label="Source step ID" value={node.fromStepId ?? ''} onChange={(fromStepId) => update({ fromStepId })} />
      <TextField label="JSON path" value={node.path ?? ''} onChange={(path) => update({ path })} />
    </>
  );
}

function AssertInspector({
  node,
  variables,
  onChange,
}: {
  node: FlowAssertNode;
  variables: string[];
  onChange: (node: FlowNode) => void;
}) {
  const update = (changes: Partial<FlowAssertNode>) => onChange({ ...node, ...changes });

  return (
    <>
      <TextField label="Name" value={node.name} onChange={(name) => update({ name })} />
      <ExecutionFields node={node} onChange={update} />
      <VariablePicker variables={variables} />
      <TextField label="Source step ID" value={node.sourceStepId ?? ''} onChange={(sourceStepId) => update({ sourceStepId })} />
      <TextField label="Field path" value={node.fieldPath} onChange={(fieldPath) => update({ fieldPath })} />
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">Operator</span>
        <select className="input" value={node.operator} onChange={(event) => update({ operator: event.target.value as FlowAssertionOperator })}>
          {assertionOperators.map((operator) => (
            <option key={operator} value={operator}>
              {operator}
            </option>
          ))}
        </select>
      </label>
      {node.operator !== 'exists' ? (
        <TextField label="Expected value" value={node.expectedValue ?? ''} onChange={(expectedValue) => update({ expectedValue })} />
      ) : null}
    </>
  );
}

function ExecutionFields<TNode extends FlowNode>({
  node,
  onChange,
}: {
  node: TNode;
  onChange: (changes: Partial<TNode>) => void;
}) {
  const retryPolicy = node.retryPolicy ?? defaultRetryPolicy;

  return (
    <section className="space-y-3 rounded-md border border-border bg-slate-50 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField label="Step timeout ms" value={node.timeoutMs ?? 30000} onChange={(timeoutMs) => onChange({ timeoutMs } as Partial<TNode>)} />
        <NumberField
          label="Retry attempts"
          value={retryPolicy.maxAttempts}
          onChange={(maxAttempts) => onChange({ retryPolicy: { ...retryPolicy, maxAttempts } } as Partial<TNode>)}
        />
      </div>
      <NumberField
        label="Retry backoff ms"
        value={retryPolicy.backoffMs}
        onChange={(backoffMs) => onChange({ retryPolicy: { ...retryPolicy, backoffMs } } as Partial<TNode>)}
      />
      <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-ink">
        <input
          type="checkbox"
          checked={node.continueOnFailure === true}
          onChange={(event) => onChange({ continueOnFailure: event.target.checked } as Partial<TNode>)}
        />
        Continue on failure
      </label>
    </section>
  );
}

function RequestFields({
  node,
  variables,
  onChange,
}: {
  node: FlowApiNode | FlowPollUntilNode;
  variables: string[];
  onChange: (changes: RequestFieldChanges) => void;
}) {
  return (
    <>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">Method</span>
        <select className="input" value={node.method} onChange={(event) => onChange({ method: event.target.value })}>
          {methods.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>
      </label>
      <TextField label="Path" value={node.path} onChange={(path) => onChange({ path })} />
      <VariablePicker variables={variables} />
      <RecordTable label="Headers" keyLabel="Header" valueLabel="Value" value={node.headers} onChange={(headers) => onChange({ headers })} />
      <RecordTable
        label="Query params"
        keyLabel="Param"
        valueLabel="Value"
        value={recordToStringMap(node.query)}
        onChange={(query) => onChange({ query })}
      />
      <JsonField label="JSON body" value={node.jsonBody} onChange={(jsonBody) => onChange({ jsonBody })} />
      <NumberField label="Expected status" value={node.expectStatus ?? 200} onChange={(expectStatus) => onChange({ expectStatus })} />
      <AssertionBuilder value={node.assertions ?? []} onChange={(assertions) => onChange({ assertions })} />
      <RecordTable label="Save variables" keyLabel="Variable" valueLabel="Response path" value={node.save} onChange={(save) => onChange({ save })} />
    </>
  );
}

function FieldErrors({ errors }: { errors: string[] }) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 space-y-1 rounded-md border border-red-200 bg-red-50 p-2 text-xs font-medium text-red-700">
      {errors.map((error) => (
        <p key={error}>{error}</p>
      ))}
    </div>
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

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <TextField
      label={label}
      type="number"
      value={String(value)}
      onChange={(nextValue) => onChange(Number(nextValue))}
    />
  );
}

function RecordTable({
  label,
  keyLabel,
  valueLabel,
  value,
  onChange,
}: {
  label: string;
  keyLabel: string;
  valueLabel: string;
  value?: Record<string, string>;
  onChange: (value: Record<string, string> | undefined) => void;
}) {
  const rows = Object.entries(value ?? {}).map(([key, entryValue], index) => ({ id: `${key}-${index}`, key, value: entryValue }));
  const updateRows = (nextRows: Array<{ key: string; value: string }>) => {
    const entries = nextRows.filter((row) => row.key.trim()).map((row) => [row.key.trim(), row.value] as const);
    onChange(entries.length > 0 ? Object.fromEntries(entries) : undefined);
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-ink">{label}</h3>
        <Button type="button" variant="secondary" className="min-h-9 px-3" onClick={() => updateRows([...rows, { key: '', value: '' }])}>
          <Plus size={14} /> Add
        </Button>
      </div>
      {rows.length === 0 ? <p className="rounded-md bg-slate-50 p-3 text-xs text-muted">No rows yet.</p> : null}
      {rows.map((row, index) => (
        <div key={row.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input
            className="input"
            aria-label={keyLabel}
            placeholder={keyLabel}
            value={row.key}
            onChange={(event) => updateRows(replaceRow(rows, index, { ...row, key: event.target.value }))}
          />
          <input
            className="input"
            aria-label={valueLabel}
            placeholder={valueLabel}
            value={row.value}
            onChange={(event) => updateRows(replaceRow(rows, index, { ...row, value: event.target.value }))}
          />
          <Button type="button" variant="ghost" className="min-h-11 px-3" onClick={() => updateRows(rows.filter((_, rowIndex) => rowIndex !== index))}>
            <Trash2 size={16} />
          </Button>
        </div>
      ))}
    </section>
  );
}

function AssertionBuilder({ value, onChange }: { value: FlowAssertion[]; onChange: (value: FlowAssertion[] | undefined) => void }) {
  const updateRows = (rows: FlowAssertion[]) => {
    const cleanRows = rows.filter((row) => row.fieldPath.trim());
    onChange(cleanRows.length > 0 ? cleanRows : undefined);
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-ink">Response assertions</h3>
        <Button
          type="button"
          variant="secondary"
          className="min-h-9 px-3"
          onClick={() => updateRows([...value, { id: `assertion-${Date.now()}`, fieldPath: '$.', operator: 'exists' }])}
        >
          <Plus size={14} /> Add
        </Button>
      </div>
      {value.length === 0 ? <p className="rounded-md bg-slate-50 p-3 text-xs text-muted">No assertions. Expected status is still checked.</p> : null}
      {value.map((assertion, index) => (
        <div key={assertion.id ?? `${assertion.fieldPath}-${index}`} className="grid gap-2">
          <div className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
            <input
              className="input"
              aria-label="Response field path"
              placeholder="$.data.status"
              value={assertion.fieldPath}
              onChange={(event) => updateRows(replaceRow(value, index, { ...assertion, fieldPath: event.target.value }))}
            />
            <select
              className="input"
              aria-label="Assertion operator"
              value={assertion.operator}
              onChange={(event) => updateRows(replaceRow(value, index, { ...assertion, operator: event.target.value as FlowAssertionOperator }))}
            >
              {assertionOperators.map((operator) => (
                <option key={operator} value={operator}>
                  {operator}
                </option>
              ))}
            </select>
            <Button type="button" variant="ghost" className="min-h-11 px-3" onClick={() => updateRows(value.filter((_, rowIndex) => rowIndex !== index))}>
              <Trash2 size={16} />
            </Button>
          </div>
          {assertion.operator !== 'exists' ? (
            <input
              className="input"
              aria-label="Expected value"
              placeholder="Expected value"
              value={assertion.expectedValue ?? ''}
              onChange={(event) => updateRows(replaceRow(value, index, { ...assertion, expectedValue: event.target.value }))}
            />
          ) : null}
        </div>
      ))}
    </section>
  );
}

function JsonField({ label, value, onChange }: { label: string; value: unknown; onChange: (value: unknown) => void }) {
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
        placeholder={'{"id": "{{ user_id }}"}'}
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

function VariablePicker({ variables }: { variables: string[] }) {
  if (variables.length === 0) {
    return <p className="rounded-md bg-slate-50 p-3 text-xs text-muted">Saved variables will appear here after you add them to previous steps.</p>;
  }

  const copyVariable = (variable: string) => {
    void navigator.clipboard?.writeText(`{{ ${variable} }}`);
  };

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium text-ink">Variables</h3>
      <div className="flex flex-wrap gap-2">
        {variables.map((variable) => (
          <button
            key={variable}
            type="button"
            className="focus-ring inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-2 text-xs font-medium text-ink"
            onClick={() => copyVariable(variable)}
          >
            <Copy size={13} /> {`{{ ${variable} }}`}
          </button>
        ))}
      </div>
    </section>
  );
}

function toReactNodes(flow?: FlowSuiteDefinition): FlowEditorNode[] {
  return (flow?.nodes ?? []).map((node) => toReactNode(normalizeNode(node)));
}

function toReactNode(flowNode: FlowNode): FlowEditorNode {
  return {
    id: flowNode.id,
    type: 'flowStep',
    position: flowNode.position,
    data: { flowNode },
  };
}

function toReactEdges(flow?: FlowSuiteDefinition): Edge[] {
  return (flow?.edges ?? []).map((edge) => ({ id: edge.id, source: edge.source, target: edge.target }));
}

function applyFlowNodeChanges(changes: NodeChange<FlowEditorNode>[], nodes: FlowEditorNode[]): FlowEditorNode[] {
  return applyNodeChanges(changes, nodes).map((node) => ({
    ...node,
    data: {
      flowNode: {
        ...node.data.flowNode,
        position: node.position,
      },
    },
  }));
}

function autoLayout(nodes: FlowEditorNode[], edges: Edge[]): FlowEditorNode[] {
  const targets = new Set(edges.map((edge) => edge.target));
  const orderedIds = [...nodes.filter((node) => !targets.has(node.id)).map((node) => node.id), ...nodes.map((node) => node.id)];
  const uniqueIds = [...new Set(orderedIds)];
  return nodes.map((node) => {
    const index = uniqueIds.indexOf(node.id);
    const position = { x: 80 + index * 280, y: 120 };
    return { ...node, position, data: { flowNode: { ...node.data.flowNode, position } } };
  });
}

function createApiNode(index: number): FlowApiNode {
  const id = `api-${Date.now()}`;
  return {
    id,
    type: 'apiRequest',
    version: 'apiRequest/v1',
    position: { x: 120 + index * 48, y: 80 + index * 32 },
    name: `API call ${index}`,
    method: 'GET',
    path: '/',
    expectStatus: 200,
    timeoutMs: 30000,
    retryPolicy: defaultRetryPolicy,
    continueOnFailure: false,
  };
}

function createWaitNode(index: number): FlowWaitNode {
  const id = `wait-${Date.now()}`;
  return {
    id,
    type: 'wait',
    version: 'wait/v1',
    position: { x: 120 + index * 48, y: 80 + index * 32 },
    name: `Wait ${index}`,
    durationMs: 1000,
    timeoutMs: 60000,
    retryPolicy: defaultRetryPolicy,
    continueOnFailure: false,
  };
}

function createPollNode(index: number): FlowPollUntilNode {
  const id = `poll-${Date.now()}`;
  return {
    id,
    type: 'pollUntil',
    version: 'pollUntil/v1',
    position: { x: 120 + index * 48, y: 80 + index * 32 },
    name: `Poll ${index}`,
    method: 'GET',
    path: '/',
    expectStatus: 200,
    timeoutSeconds: 30,
    intervalSeconds: 2,
    timeoutMs: 30000,
    retryPolicy: defaultRetryPolicy,
    continueOnFailure: false,
  };
}

function createSetVariableNode(index: number): FlowSetVariableNode {
  const id = `set-variable-${Date.now()}`;
  return {
    id,
    type: 'setVariable',
    version: 'setVariable/v1',
    position: { x: 120 + index * 48, y: 80 + index * 32 },
    name: `Set variable ${index}`,
    variableName: `variable_${index}`,
    value: '',
    timeoutMs: 30000,
    retryPolicy: defaultRetryPolicy,
    continueOnFailure: false,
  };
}

function createAssertNode(index: number): FlowAssertNode {
  const id = `assert-${Date.now()}`;
  return {
    id,
    type: 'assert',
    version: 'assert/v1',
    position: { x: 120 + index * 48, y: 80 + index * 32 },
    name: `Assert ${index}`,
    fieldPath: '$.',
    operator: 'exists',
    timeoutMs: 30000,
    retryPolicy: defaultRetryPolicy,
    continueOnFailure: false,
  };
}

function normalizeNode(node: FlowNode): FlowNode {
  const type = node.type ?? 'apiRequest';
  return {
    ...node,
    type,
    version: node.version ?? `${type}/v1`,
    timeoutMs: node.timeoutMs ?? 30000,
    retryPolicy: node.retryPolicy ?? defaultRetryPolicy,
    continueOnFailure: node.continueOnFailure === true,
  } as FlowNode;
}

function validateFlow(flow: FlowSuiteDefinition): string[] {
  const errors: string[] = [];
  for (const node of flow.nodes.map(normalizeNode)) {
    if (!node.name.trim()) {
      errors.push(`Step ${node.id} needs a name.`);
    }
    if (isWaitNode(node)) {
      if (!Number.isFinite(node.durationMs) || node.durationMs <= 0) {
        errors.push(`Wait step "${node.name}" needs a duration greater than 0 ms.`);
      }
      continue;
    }
    if (isSetVariableNode(node)) {
      if (!node.variableName.trim()) {
        errors.push(`Set variable step "${node.name}" needs a variable name.`);
      }
      continue;
    }
    if (isAssertNode(node)) {
      if (!node.fieldPath.trim()) {
        errors.push(`Assert step "${node.name}" needs a response field path.`);
      }
      continue;
    }
    if (!node.path.trim()) {
      errors.push(`API step "${node.name}" needs a path.`);
    }
    for (const key of Object.keys(node.save ?? {})) {
      if (!key.trim()) {
        errors.push(`Saved variable in "${node.name}" needs a name.`);
      }
    }
    for (const assertion of node.assertions ?? []) {
      if (!assertion.fieldPath.trim()) {
        errors.push(`Assertion in "${node.name}" needs a response field path.`);
      }
    }
    if (isPollNode(node)) {
      if (!Number.isFinite(node.timeoutSeconds) || node.timeoutSeconds <= 0) {
        errors.push(`Poll step "${node.name}" needs a timeout greater than 0 seconds.`);
      }
      if (!Number.isFinite(node.intervalSeconds) || node.intervalSeconds <= 0) {
        errors.push(`Poll step "${node.name}" needs a retry interval greater than 0 seconds.`);
      }
      if (node.intervalSeconds > node.timeoutSeconds) {
        errors.push(`Poll step "${node.name}" interval cannot be greater than timeout.`);
      }
    }
  }
  return errors;
}

function collectVariables(nodes: FlowEditorNode[]): string[] {
  const variables = nodes.flatMap((node) => {
    const flowNode = node.data.flowNode;
    if (isWaitNode(flowNode) || isAssertNode(flowNode)) {
      return [];
    }
    if (isSetVariableNode(flowNode)) {
      return [flowNode.variableName];
    }
    return Object.keys(flowNode.save ?? {});
  });
  return [...new Set(variables.filter(Boolean))];
}

function stepTypeLabel(node: FlowNode): string {
  if (isWaitNode(node)) {
    return 'Wait';
  }
  if (isPollNode(node)) {
    return 'Poll until';
  }
  if (isSetVariableNode(node)) {
    return 'Set variable';
  }
  if (isAssertNode(node)) {
    return 'Assert';
  }
  return node.method;
}

function stepSummary(node: FlowNode): string {
  if (isWaitNode(node)) {
    return `${node.durationMs} ms`;
  }
  if (isPollNode(node)) {
    return `${node.method} ${node.path} for ${node.timeoutSeconds}s`;
  }
  if (isSetVariableNode(node)) {
    return node.variableName;
  }
  if (isAssertNode(node)) {
    return `${node.fieldPath} ${node.operator}`;
  }
  return node.path;
}

function isWaitNode(node: FlowNode): node is FlowWaitNode {
  return node.type === 'wait';
}

function isPollNode(node: FlowNode): node is FlowPollUntilNode {
  return node.type === 'pollUntil';
}

function isSetVariableNode(node: FlowNode): node is FlowSetVariableNode {
  return node.type === 'setVariable';
}

function isAssertNode(node: FlowNode): node is FlowAssertNode {
  return node.type === 'assert';
}

function replaceRow<T>(rows: T[], index: number, row: T): T[] {
  return rows.map((item, itemIndex) => (itemIndex === index ? row : item));
}

function recordToStringMap(value?: Record<string, unknown>): Record<string, string> | undefined {
  if (!value) {
    return undefined;
  }
  return Object.fromEntries(Object.entries(value).map(([key, entryValue]) => [key, String(entryValue)]));
}

function formatJson(value: unknown): string {
  return value === undefined ? '' : JSON.stringify(value, null, 2);
}
