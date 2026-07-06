import { useEffect, useRef } from 'react';
import type { FlowNode } from '../../../types';
import type { FlowValidationField, FlowValidationIssue } from './types';
import { fieldElementId, isAssertNode, isPollNode, isSetVariableNode, isWaitNode, stepTypeLabel } from './lib/flowNodeUtils';
import { issuesForNode } from './lib/flowValidation';
import { ApiInspector } from './inspectors/ApiInspector';
import { AssertInspector } from './inspectors/AssertInspector';
import { PollInspector } from './inspectors/PollInspector';
import { SetVariableInspector } from './inspectors/SetVariableInspector';
import { WaitInspector } from './inspectors/WaitInspector';
import { FieldErrors } from './inspectors/fields/FieldErrors';

interface NodeInspectorProps {
  node?: FlowNode;
  variables: string[];
  issues: FlowValidationIssue[];
  focusField?: FlowValidationField;
  readOnly?: boolean;
  onChange: (node: FlowNode) => void;
  onFocusHandled?: () => void;
}

export function NodeInspector({
  node,
  variables,
  issues,
  focusField,
  readOnly = false,
  onChange,
  onFocusHandled,
}: NodeInspectorProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!node) {
      return;
    }
    if (focusField) {
      const element = document.getElementById(fieldElementId(node.id, focusField));
      if (element instanceof HTMLElement) {
        element.focus();
        element.scrollIntoView({ block: 'nearest' });
        onFocusHandled?.();
        return;
      }
    }
    headingRef.current?.focus();
  }, [node, focusField, onFocusHandled]);

  if (!node) {
    return (
      <aside className="rounded-lg border border-border bg-white p-4 text-sm text-muted shadow-sm" tabIndex={-1}>
        Select a step to edit details.
      </aside>
    );
  }

  const nodeIssues = issuesForNode(issues, node.id);

  return (
    <aside
      className="max-h-[760px] space-y-4 overflow-y-auto rounded-lg border border-border bg-white p-4 shadow-sm"
      aria-label="Step inspector"
    >
      <div>
        <h2 ref={headingRef} tabIndex={-1} className="text-sm font-semibold text-ink outline-none">
          {stepTypeLabel(node)} step
        </h2>
        <FieldErrors issues={nodeIssues} />
      </div>
      {isWaitNode(node) ? (
        <WaitInspector node={node} readOnly={readOnly} onChange={onChange} issues={nodeIssues} />
      ) : isPollNode(node) ? (
        <PollInspector node={node} variables={variables} readOnly={readOnly} onChange={onChange} issues={nodeIssues} />
      ) : isSetVariableNode(node) ? (
        <SetVariableInspector node={node} variables={variables} readOnly={readOnly} onChange={onChange} issues={nodeIssues} />
      ) : isAssertNode(node) ? (
        <AssertInspector node={node} variables={variables} readOnly={readOnly} onChange={onChange} issues={nodeIssues} />
      ) : (
        <ApiInspector node={node} variables={variables} readOnly={readOnly} onChange={onChange} issues={nodeIssues} />
      )}
    </aside>
  );
}
