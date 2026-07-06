import { useCallback, useEffect, useRef } from 'react';
import type { Edge } from '@xyflow/react';
import type { FlowDraftRecord, FlowEditorNode } from '../types';
import type { FlowSuiteDefinition } from '../../../../types';
import { shouldOfferDraftRestore } from '../lib/flowDraft';
import { serializeFlowForCompare } from '../lib/flowGraph';
import { buildFlowDefinition, toReactEdges, toReactNodes } from '../lib/flowSerialization';

const DEBOUNCE_MS = 1500;

export function draftStorageKey(projectId: string, suiteId?: string): string {
  return `te-flow-draft:${projectId}:${suiteId ?? 'new'}`;
}

export function readDraft(key: string): FlowDraftRecord | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as FlowDraftRecord;
    if (!parsed?.flow || typeof parsed.savedAt !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  localStorage.removeItem(key);
}

export function useFlowDraftAutosave({
  projectId,
  suiteId,
  suiteName,
  initialFlow,
  nodes,
  edges,
  enabled,
  onDraftAvailable,
}: {
  projectId: string;
  suiteId?: string;
  suiteName: string;
  initialFlow?: FlowSuiteDefinition;
  nodes: FlowEditorNode[];
  edges: Edge[];
  enabled: boolean;
  onDraftAvailable?: (draft: FlowDraftRecord) => void;
}) {
  const key = draftStorageKey(projectId, suiteId);
  const timerRef = useRef<number | null>(null);
  const notifiedRef = useRef(false);
  const baselineFlow = useRef<FlowSuiteDefinition>(
    initialFlow ?? { version: '1.1', suiteName, nodes: [], edges: [] },
  );

  useEffect(() => {
    baselineFlow.current = initialFlow ?? { version: '1.1', suiteName, nodes: [], edges: [] };
  }, [initialFlow, suiteName]);

  useEffect(() => {
    if (!enabled || notifiedRef.current) {
      return;
    }
    const draft = readDraft(key);
    if (draft && shouldOfferDraftRestore(draft, baselineFlow.current)) {
      notifiedRef.current = true;
      onDraftAvailable?.(draft);
    }
  }, [enabled, key, onDraftAvailable]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      const flow = buildFlowDefinition(suiteName, nodes, edges);
      if (serializeFlowForCompare(flow) === serializeFlowForCompare(baselineFlow.current)) {
        clearDraft(key);
        return;
      }
      const record: FlowDraftRecord = { flow, savedAt: Date.now() };
      localStorage.setItem(key, JSON.stringify(record));
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [enabled, key, suiteName, nodes, edges]);

  const restoreDraft = useCallback(
    (draft: FlowDraftRecord) => ({ nodes: toReactNodes(draft.flow), edges: toReactEdges(draft.flow) }),
    [],
  );

  const discardDraft = useCallback(() => {
    clearDraft(key);
  }, [key]);

  const clearDraftOnSave = useCallback(() => {
    clearDraft(key);
  }, [key]);

  return { restoreDraft, discardDraft, clearDraftOnSave };
}
