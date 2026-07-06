import type { FlowNode } from '../../../../types';
import { defaultRetryPolicy } from '../lib/flowNodeUtils';
import { NumberField } from './fields/TextField';

export function ExecutionFields<TNode extends FlowNode>({
  node,
  readOnly = false,
  onChange,
}: {
  node: TNode;
  readOnly?: boolean;
  onChange: (changes: Partial<TNode>) => void;
}) {
  const retryPolicy = node.retryPolicy ?? defaultRetryPolicy;

  return (
    <section className="space-y-3 rounded-md border border-border bg-slate-50 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField nodeId={node.id} field="name" label="Step timeout ms" value={node.timeoutMs ?? 30000} readOnly={readOnly} onChange={(timeoutMs) => onChange({ timeoutMs } as Partial<TNode>)} />
        <NumberField nodeId={node.id} field="name" label="Retry attempts" value={retryPolicy.maxAttempts} readOnly={readOnly} onChange={(maxAttempts) => onChange({ retryPolicy: { ...retryPolicy, maxAttempts } } as Partial<TNode>)} />
      </div>
      <NumberField nodeId={node.id} field="name" label="Retry backoff ms" value={retryPolicy.backoffMs} readOnly={readOnly} onChange={(backoffMs) => onChange({ retryPolicy: { ...retryPolicy, backoffMs } } as Partial<TNode>)} />
      <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-ink">
        <input type="checkbox" disabled={readOnly} checked={node.continueOnFailure === true} onChange={(event) => onChange({ continueOnFailure: event.target.checked } as Partial<TNode>)} />
        Continue on failure
      </label>
    </section>
  );
}
