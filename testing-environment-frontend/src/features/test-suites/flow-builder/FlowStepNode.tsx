import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { Format } from '../../../lib/format';
import type { FlowEditorNode } from './types';
import { stepSummary, stepTypeLabel } from './lib/flowNodeUtils';

export function FlowStepNode({ data, selected }: NodeProps<FlowEditorNode>) {
  const node = data.flowNode;
  const typeLabel = stepTypeLabel(node);
  const validationStatus = data.validationStatus ?? 'valid';
  const executionResult = data.executionResult;
  const dimmed = data.searchMatch === false;

  const validationLabel =
    validationStatus === 'error' ? 'has validation errors' : 'valid';

  return (
    <article
      role="group"
      aria-label={`${typeLabel} step ${node.name}, ${validationLabel}`}
      aria-selected={selected}
      className={`min-w-60 rounded-md border bg-white px-3 py-2 text-left shadow-sm ${
        selected ? 'border-brand ring-2 ring-brand/20' : 'border-border'
      } ${dimmed ? 'opacity-40' : ''} ${validationStatus === 'error' ? 'border-red-300' : ''}`}
    >
      <Handle type="target" position={Position.Left} aria-label="Connect from previous step" />
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase text-brand">{typeLabel}</p>
        <ValidationBadge status={validationStatus} />
      </div>
      <h3 className="truncate text-sm font-semibold text-ink">{node.name}</h3>
      <p className="truncate text-xs text-muted">{stepSummary(node)}</p>
      {executionResult ? (
        <p
          className={`mt-1 text-xs font-semibold ${executionResult.status === 'PASSED' ? 'text-green-700' : 'text-red-700'}`}
          aria-label={`Execution ${executionResult.status.toLowerCase()}, ${Format.duration(executionResult.durationMs)}`}
        >
          {executionResult.status} · {Format.duration(executionResult.durationMs)}
        </p>
      ) : null}
      <Handle type="source" position={Position.Right} aria-label="Connect to next step" />
    </article>
  );
}

function ValidationBadge({ status }: { status: 'valid' | 'error' }) {
  if (status === 'valid') {
    return (
      <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-green-700" aria-hidden="true">
        OK
      </span>
    );
  }
  return (
    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-700" aria-hidden="true">
      Error
    </span>
  );
}
