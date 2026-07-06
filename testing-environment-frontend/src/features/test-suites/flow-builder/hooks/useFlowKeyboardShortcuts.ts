import { useEffect } from 'react';
import { copySelection } from '../lib/flowClipboard';
import type { FlowEditorNode } from '../types';
import type { Edge } from '@xyflow/react';

interface UseFlowKeyboardShortcutsOptions {
  enabled: boolean;
  nodes: FlowEditorNode[];
  edges: Edge[];
  selectedNodeIds: string[];
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onFocusSearch: () => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

export function useFlowKeyboardShortcuts({
  enabled,
  nodes,
  edges,
  selectedNodeIds,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onCopy,
  onPaste,
  onDuplicate,
  onDelete,
  onSelectAll,
  onClearSelection,
  onFocusSearch,
}: UseFlowKeyboardShortcutsOptions) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      const meta = event.metaKey || event.ctrlKey;

      if (meta && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        if (canUndo) {
          onUndo();
        }
        return;
      }

      if ((meta && event.shiftKey && event.key.toLowerCase() === 'z') || (meta && event.key.toLowerCase() === 'y')) {
        event.preventDefault();
        if (canRedo) {
          onRedo();
        }
        return;
      }

      if (meta && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        if (selectedNodeIds.length > 0) {
          copySelection(nodes, edges, selectedNodeIds);
          onCopy();
        }
        return;
      }

      if (meta && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        onPaste();
        return;
      }

      if (meta && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        onDuplicate();
        return;
      }

      if (meta && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        onSelectAll();
        return;
      }

      if (meta && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        onFocusSearch();
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedNodeIds.length > 0) {
          event.preventDefault();
          onDelete();
        }
        return;
      }

      if (event.key === 'Escape') {
        onClearSelection();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    enabled,
    nodes,
    edges,
    selectedNodeIds,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onCopy,
    onPaste,
    onDuplicate,
    onDelete,
    onSelectAll,
    onClearSelection,
    onFocusSearch,
  ]);
}
