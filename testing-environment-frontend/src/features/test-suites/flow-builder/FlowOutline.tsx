import { useEffect, useRef } from 'react';
import { CheckCircle2, Clock3, SearchCheck, Send, Variable } from 'lucide-react';
import { Format } from '../../../lib/format';
import type { TestResult } from '../../../types';
import type { FlowEditorNode, FlowValidationIssue } from './types';
import { issuesForNode, validationStatusForNode } from './lib/flowValidation';
import { stepSummary, stepTypeLabel } from './lib/flowNodeUtils';
import { topologicalSort } from './lib/flowGraph';
import type { Edge } from '@xyflow/react';

interface FlowOutlineProps {
  nodes: FlowEditorNode[];
  edges: Edge[];
  selectedNodeIds: string[];
  issues: FlowValidationIssue[];
  searchQuery: string;
  executionResults?: Record<string, TestResult>;
  onSelect: (nodeId: string) => void;
}

export function FlowOutline({
  nodes,
  edges,
  selectedNodeIds,
  issues,
  searchQuery,
  executionResults,
  onSelect,
}: FlowOutlineProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const orderedIds = topologicalSort(
    nodes.map((node) => node.id),
    edges,
  );
  const orderedNodes = orderedIds.map((id) => nodes.find((node) => node.id === id)).filter(Boolean) as FlowEditorNode[];

  const filtered = orderedNodes.filter((node) => {
    if (!searchQuery.trim()) {
      return true;
    }
    const haystack = `${node.data.flowNode.name} ${stepTypeLabel(node.data.flowNode)} ${stepSummary(node.data.flowNode)}`.toLowerCase();
    return haystack.includes(searchQuery.trim().toLowerCase());
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.target instanceof HTMLElement) || !listRef.current?.contains(event.target)) {
        return;
      }
      const currentIndex = filtered.findIndex((node) => selectedNodeIds.includes(node.id));
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const next = filtered[Math.min(currentIndex + 1, filtered.length - 1)];
        if (next) {
          onSelect(next.id);
        }
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        const next = filtered[Math.max(currentIndex - 1, 0)];
        if (next) {
          onSelect(next.id);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [filtered, selectedNodeIds, onSelect]);

  if (filtered.length === 0) {
    return (
      <div className="flex h-[540px] items-center justify-center p-6 text-sm text-muted">
        {searchQuery ? 'No steps match your search.' : 'No steps yet.'}
      </div>
    );
  }

  return (
    <ol ref={listRef} className="max-h-[540px] space-y-2 overflow-y-auto p-3" aria-label="Flow outline">
      {filtered.map((node) => {
        const flowNode = node.data.flowNode;
        const nodeIssues = issuesForNode(issues, node.id);
        const status = validationStatusForNode(issues, node.id);
        const result = executionResults?.[node.id];
        const selected = selectedNodeIds.includes(node.id);

        return (
          <li key={node.id}>
            <button
              type="button"
              aria-current={selected ? 'true' : undefined}
              className={`focus-ring flex w-full items-start gap-3 rounded-md border p-3 text-left ${
                selected ? 'border-brand bg-brand/5' : 'border-border bg-white'
              }`}
              onClick={() => onSelect(node.id)}
            >
              <span className="mt-0.5 text-brand" aria-hidden="true">
                <StepIcon type={flowNode.type} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{flowNode.name}</span>
                  <span className="text-xs uppercase text-muted">{stepTypeLabel(flowNode)}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      status === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                    }`}
                  >
                    {status === 'error' ? 'Error' : 'OK'}
                  </span>
                  {result ? (
                    <span className={`text-[10px] font-semibold uppercase ${result.status === 'PASSED' ? 'text-green-700' : 'text-red-700'}`}>
                      {result.status}
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block truncate text-xs text-muted">{stepSummary(flowNode)}</span>
                {result ? <span className="mt-1 block text-xs text-muted">{Format.duration(result.durationMs)}</span> : null}
                {nodeIssues.length > 0 ? (
                  <span className="mt-1 block text-xs font-medium text-red-700">{nodeIssues[0].message}</span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function StepIcon({ type }: { type?: string }) {
  if (type === 'wait') {
    return <Clock3 size={18} />;
  }
  if (type === 'pollUntil') {
    return <SearchCheck size={18} />;
  }
  if (type === 'setVariable') {
    return <Variable size={18} />;
  }
  if (type === 'assert') {
    return <CheckCircle2 size={18} />;
  }
  return <Send size={18} />;
}
