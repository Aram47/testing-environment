import type { FlowValidationIssue } from '../../types';

export function FieldErrors({ issues }: { issues: FlowValidationIssue[] }) {
  if (issues.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 space-y-1 rounded-md border border-red-200 bg-red-50 p-2 text-xs font-medium text-red-700" role="alert">
      {issues.map((issue) => (
        <p key={`${issue.nodeId}-${issue.field ?? 'general'}-${issue.message}`}>{issue.message}</p>
      ))}
    </div>
  );
}
