import { CheckCircle2, Clock3, LayoutList, LayoutPanelLeft, Plus, Redo2, Search, SearchCheck, Undo2, Variable, Wand2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import type { FlowViewMode, NodeTemplateId } from './types';

interface FlowToolbarProps {
  readOnly?: boolean;
  canUndo: boolean;
  canRedo: boolean;
  isCompiling: boolean;
  viewMode: FlowViewMode;
  searchQuery: string;
  searchInputRef: React.RefObject<HTMLInputElement>;
  onAddApi: () => void;
  onAddWait: () => void;
  onAddPoll: () => void;
  onAddSetVariable: () => void;
  onAddAssert: () => void;
  onTemplate: (templateId: NodeTemplateId) => void;
  onUndo: () => void;
  onRedo: () => void;
  onAutoLayout: () => void;
  onValidate: () => void;
  onViewModeChange: (mode: FlowViewMode) => void;
  onSearchChange: (query: string) => void;
}

const templates: Array<{ id: NodeTemplateId; label: string }> = [
  { id: 'health-check', label: 'Health check' },
  { id: 'create-resource', label: 'Create resource' },
  { id: 'poll-status', label: 'Poll status' },
  { id: 'wait-1s', label: 'Wait 1s' },
  { id: 'assert-field', label: 'Assert field' },
];

export function FlowToolbar({
  readOnly = false,
  canUndo,
  canRedo,
  isCompiling,
  viewMode,
  searchQuery,
  searchInputRef,
  onAddApi,
  onAddWait,
  onAddPoll,
  onAddSetVariable,
  onAddAssert,
  onTemplate,
  onUndo,
  onRedo,
  onAutoLayout,
  onValidate,
  onViewModeChange,
  onSearchChange,
}: FlowToolbarProps) {
  if (readOnly) {
    return (
      <aside className="rounded-lg border border-border bg-white p-3 shadow-sm">
        <p className="text-sm text-muted">Read-only flow view from test run.</p>
        <div className="mt-3 flex gap-2">
          <Button type="button" variant={viewMode === 'canvas' ? 'primary' : 'secondary'} className="flex-1" onClick={() => onViewModeChange('canvas')}>
            <LayoutPanelLeft size={16} /> Canvas
          </Button>
          <Button type="button" variant={viewMode === 'outline' ? 'primary' : 'secondary'} className="flex-1" onClick={() => onViewModeChange('outline')}>
            <LayoutList size={16} /> Outline
          </Button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="rounded-lg border border-border bg-white p-3 shadow-sm">
      <div className="space-y-2">
        <label className="block">
          <span className="sr-only">Search steps</span>
          <span className="relative flex items-center">
            <Search size={16} className="pointer-events-none absolute left-3 text-muted" aria-hidden="true" />
            <input
              ref={searchInputRef}
              className="input pl-9"
              placeholder="Search steps (Ctrl+F)"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              aria-label="Search flow steps"
            />
          </span>
        </label>

        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" disabled={!canUndo} onClick={onUndo} aria-label="Undo">
            <Undo2 size={16} />
          </Button>
          <Button type="button" variant="secondary" className="flex-1" disabled={!canRedo} onClick={onRedo} aria-label="Redo">
            <Redo2 size={16} />
          </Button>
        </div>

        <div className="flex gap-2">
          <Button type="button" variant={viewMode === 'canvas' ? 'primary' : 'secondary'} className="flex-1" onClick={() => onViewModeChange('canvas')}>
            <LayoutPanelLeft size={16} /> Canvas
          </Button>
          <Button type="button" variant={viewMode === 'outline' ? 'primary' : 'secondary'} className="flex-1" onClick={() => onViewModeChange('outline')}>
            <LayoutList size={16} /> Outline
          </Button>
        </div>

        <Button type="button" className="w-full justify-start" onClick={onAddApi}>
          <Plus size={16} /> Add API
        </Button>
        <Button type="button" variant="secondary" className="w-full justify-start" onClick={onAddWait}>
          <Clock3 size={16} /> Add Wait
        </Button>
        <Button type="button" variant="secondary" className="w-full justify-start" onClick={onAddPoll}>
          <SearchCheck size={16} /> Add Poll
        </Button>
        <Button type="button" variant="secondary" className="w-full justify-start" onClick={onAddSetVariable}>
          <Variable size={16} /> Add Set Variable
        </Button>
        <Button type="button" variant="secondary" className="w-full justify-start" onClick={onAddAssert}>
          <CheckCircle2 size={16} /> Add Assert
        </Button>

        <div className="border-t border-border pt-2">
          <p className="mb-2 text-xs font-semibold uppercase text-muted">Templates</p>
          {templates.map((template) => (
            <Button key={template.id} type="button" variant="ghost" className="w-full justify-start text-sm" onClick={() => onTemplate(template.id)}>
              {template.label}
            </Button>
          ))}
        </div>

        <Button type="button" variant="secondary" className="w-full justify-start" onClick={onAutoLayout}>
          <Wand2 size={16} /> Auto layout
        </Button>
        <Button type="button" variant="secondary" className="w-full justify-start" disabled={isCompiling} onClick={onValidate}>
          <CheckCircle2 size={16} /> {isCompiling ? 'Validating' : 'Validate'}
        </Button>
      </div>
    </aside>
  );
}
