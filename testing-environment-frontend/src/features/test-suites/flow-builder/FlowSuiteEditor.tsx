import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileCode2, Plus } from 'lucide-react';
import { testSuitesApi } from '../../../api/test-suites.api';
import { ConfirmDialog } from '../../../components/modals/ConfirmDialog';
import { Button } from '../../../components/ui/Button';
import { FlowCanvas } from './FlowCanvas';
import { FlowOutline } from './FlowOutline';
import { FlowToolbar } from './FlowToolbar';
import { createApiNode, createAssertNode, createPollNode, createSetVariableNode, createWaitNode } from './lib/flowNodeFactory';
import { useFlowDraftAutosave } from './hooks/useFlowDraftAutosave';
import { useFlowEditorState } from './hooks/useFlowEditorState';
import { useFlowKeyboardShortcuts } from './hooks/useFlowKeyboardShortcuts';
import { collectVariables, nodeMatchesSearch } from './lib/flowNodeUtils';
import { issueMessages, validateFlow, validationStatusForNode } from './lib/flowValidation';
import { NodeInspector } from './NodeInspector';
import type { FlowDraftRecord, FlowSuiteEditorProps, FlowValidationField, FlowViewMode } from './types';

export function FlowSuiteEditor({
  projectId,
  suiteId,
  suiteName,
  initialFlow,
  initialYaml,
  onSave,
  onMessage,
  onDirtyChange,
  readOnly = false,
  executionResults,
}: FlowSuiteEditorProps) {
  const editor = useFlowEditorState(suiteName, initialFlow);
  const buildFlow = editor.buildFlow;
  const [yamlPreview, setYamlPreview] = useState(initialYaml);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [issues, setIssues] = useState<ReturnType<typeof validateFlow>>([]);
  const [isCompiling, setIsCompiling] = useState(false);
  const [viewMode, setViewMode] = useState<FlowViewMode>('canvas');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [focusField, setFocusField] = useState<FlowValidationField | undefined>();
  const [draftBanner, setDraftBanner] = useState<FlowDraftRecord | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { discardDraft, clearDraftOnSave } = useFlowDraftAutosave({
    projectId,
    suiteId,
    suiteName,
    initialFlow,
    nodes: editor.nodes,
    edges: editor.edges,
    enabled: !readOnly,
    onDraftAvailable: setDraftBanner,
  });

  useEffect(() => {
    onDirtyChange?.(editor.isDirty);
  }, [editor.isDirty, onDirtyChange]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (editor.isDirty && !readOnly) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [editor.isDirty, readOnly]);

  const variables = useMemo(() => collectVariables(editor.nodes), [editor.nodes]);

  const decoratedNodes = useMemo(() => {
    const query = searchQuery.trim();
    return editor.nodes.map((node) => ({
      ...node,
      selected: editor.selectedNodeIds.includes(node.id),
      data: {
        ...node.data,
        validationStatus: validationStatusForNode(issues, node.id),
        executionResult: executionResults?.[node.id],
        searchMatch: query ? nodeMatchesSearch(node.data.flowNode, query) : true,
      },
    }));
  }, [editor.nodes, editor.selectedNodeIds, issues, executionResults, searchQuery]);

  const compileFlow = useCallback(async () => {
    const flow = buildFlow();
    const validationIssues = validateFlow(flow);
    setIssues(validationIssues);
    if (validationIssues.length > 0) {
      onMessage(validationIssues[0].message, 'error');
      return false;
    }

    setIsCompiling(true);
    try {
      const result = await testSuitesApi.compileFlow(projectId, flow);
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
  }, [buildFlow, onMessage, projectId]);

  const save = async () => {
    if (await compileFlow()) {
      const flow = buildFlow();
      clearDraftOnSave();
      onSave(flow);
    }
  };

  const handleValidate = () => {
    const validationIssues = validateFlow(buildFlow());
    setIssues(validationIssues);
    if (validationIssues.length === 0) {
      void compileFlow();
    } else {
      onMessage(validationIssues[0].message, 'error');
    }
  };

  const handleIssueClick = (nodeId: string, field?: FlowValidationField) => {
    editor.selectNode(nodeId);
    setFocusField(field);
    setViewMode('canvas');
  };

  const handleRestoreDraft = () => {
    if (!draftBanner) {
      return;
    }
    editor.restoreSnapshot(draftBanner.flow);
    setDraftBanner(null);
    discardDraft();
    onMessage('Draft restored', 'info');
  };

  const handleDiscardDraft = () => {
    discardDraft();
    setDraftBanner(null);
  };

  useFlowKeyboardShortcuts({
    enabled: !readOnly,
    nodes: editor.nodes,
    edges: editor.edges,
    selectedNodeIds: editor.selectedNodeIds,
    canUndo: editor.canUndo,
    canRedo: editor.canRedo,
    onUndo: editor.undo,
    onRedo: editor.redo,
    onCopy: () => onMessage('Copied selected steps', 'info'),
    onPaste: editor.paste,
    onDuplicate: editor.duplicateSelected,
    onDelete: () => {
      if (editor.selectedNodeIds.length > 0) {
        setDeleteOpen(true);
      }
    },
    onSelectAll: editor.selectAll,
    onClearSelection: () => {
      editor.selectNode(undefined);
      setSearchQuery('');
    },
    onFocusSearch: () => searchInputRef.current?.focus(),
  });

  return (
    <section className="space-y-4">
      {draftBanner && !readOnly ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p>A newer local draft is available from {new Date(draftBanner.savedAt).toLocaleString()}.</p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={handleDiscardDraft}>
              Discard
            </Button>
            <Button type="button" onClick={handleRestoreDraft}>
              Restore draft
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[190px_minmax(0,1fr)_380px]">
        <FlowToolbar
          readOnly={readOnly}
          canUndo={editor.canUndo}
          canRedo={editor.canRedo}
          isCompiling={isCompiling}
          viewMode={viewMode}
          searchQuery={searchQuery}
          searchInputRef={searchInputRef}
          onAddApi={() => editor.addNode(createApiNode(editor.nodes.length + 1))}
          onAddWait={() => editor.addNode(createWaitNode(editor.nodes.length + 1))}
          onAddPoll={() => editor.addNode(createPollNode(editor.nodes.length + 1))}
          onAddSetVariable={() => editor.addNode(createSetVariableNode(editor.nodes.length + 1))}
          onAddAssert={() => editor.addNode(createAssertNode(editor.nodes.length + 1))}
          onTemplate={editor.addTemplate}
          onUndo={editor.undo}
          onRedo={editor.redo}
          onAutoLayout={editor.runAutoLayout}
          onValidate={handleValidate}
          onViewModeChange={setViewMode}
          onSearchChange={setSearchQuery}
        />

        <div className="min-h-[540px] overflow-hidden rounded-lg border border-border bg-white shadow-sm">
          {editor.nodes.length === 0 ? (
            <div className="flex h-[540px] flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-lg font-semibold text-ink">Create your first flow step</p>
              <p className="max-w-sm text-sm text-muted">Combine API requests, waits, and polling to describe a real backend flow.</p>
              {!readOnly ? (
                <Button type="button" onClick={() => editor.addNode(createApiNode(1))}>
                  <Plus size={16} /> Add first API
                </Button>
              ) : null}
            </div>
          ) : viewMode === 'outline' ? (
            <FlowOutline
              nodes={decoratedNodes}
              edges={editor.edges}
              selectedNodeIds={editor.selectedNodeIds}
              issues={issues}
              searchQuery={searchQuery}
              executionResults={executionResults}
              onSelect={(nodeId) => editor.selectNode(nodeId)}
            />
          ) : (
            <FlowCanvas
              nodes={decoratedNodes}
              edges={editor.edges}
              readOnly={readOnly}
              onNodesChange={editor.onNodesChange}
              onNodeDragStop={editor.onNodeDragStop}
              onEdgesChange={editor.onEdgesChange}
              onConnect={editor.onConnect}
              onNodeClick={(_event, node) => editor.selectNode(node.id)}
              onPaneClick={() => editor.selectNode(undefined)}
              onSelectionChange={editor.setSelectedNodeIds}
            />
          )}
        </div>

        <NodeInspector
          node={editor.selectedNode?.data.flowNode}
          variables={variables}
          issues={issues}
          focusField={focusField}
          readOnly={readOnly}
          onChange={editor.updateNode}
          onFocusHandled={() => setFocusField(undefined)}
        />
      </div>

      {[...issueMessages(issues), ...warnings].length > 0 ? (
        <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
          {issues.map((issue) => (
            <button
              key={`${issue.nodeId}-${issue.field ?? 'general'}-${issue.message}`}
              type="button"
              className="focus-ring block w-full rounded px-1 py-0.5 text-left hover:bg-amber-100"
              onClick={() => handleIssueClick(issue.nodeId, issue.field)}
            >
              {issue.message}
            </button>
          ))}
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      {!readOnly ? (
        <>
          <section className="rounded-lg border border-border bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-ink">YAML export preview</h2>
              <Button type="button" variant="secondary" disabled={isCompiling} onClick={() => void compileFlow()}>
                <FileCode2 size={16} /> Refresh preview
              </Button>
            </div>
            <pre className="max-h-80 overflow-auto rounded-md bg-slate-950 p-4 text-sm leading-6 text-slate-100">{yamlPreview || 'YAML preview will appear here.'}</pre>
          </section>

          <div className="flex justify-end">
            <Button type="button" disabled={isCompiling || editor.nodes.length === 0} onClick={() => void save()}>
              Save flow
            </Button>
          </div>
        </>
      ) : null}

      <ConfirmDialog
        open={deleteOpen}
        title="Delete selected steps"
        description={`Delete ${editor.selectedNodeIds.length} selected step(s)? Connected edges will be removed.`}
        confirmLabel="Delete"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          editor.deleteSelected();
          setDeleteOpen(false);
          onMessage('Selected steps deleted', 'info');
        }}
      />
    </section>
  );
}
