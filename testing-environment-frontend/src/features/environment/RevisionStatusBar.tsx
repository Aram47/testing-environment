import { History, Rocket } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import type { EnvironmentConfigRevision } from '../../types';

interface RevisionStatusBarProps {
  currentRevision?: EnvironmentConfigRevision;
  publishedRevision?: EnvironmentConfigRevision;
  sourceMode: string;
  isPublishing?: boolean;
  onPublish?: (revisionId: string) => void;
  onOpenHistory?: () => void;
}

function StatusBadge({ label, tone }: { label: string; tone: 'draft' | 'published' | 'neutral' }) {
  const classes =
    tone === 'draft'
      ? 'bg-amber-100 text-amber-900'
      : tone === 'published'
        ? 'bg-emerald-100 text-emerald-900'
        : 'bg-slate-100 text-slate-700';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${classes}`}>{label}</span>;
}

export function RevisionStatusBar({
  currentRevision,
  publishedRevision,
  sourceMode,
  isPublishing = false,
  onPublish,
  onOpenHistory,
}: RevisionStatusBarProps) {
  const canPublish = currentRevision?.status === 'DRAFT';

  return (
    <section className="panel space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-ink">
              Revision {currentRevision ? `#${currentRevision.revisionNumber}` : 'not saved'}
            </h2>
            {currentRevision ? (
              <StatusBadge
                label={currentRevision.status}
                tone={currentRevision.status === 'PUBLISHED' ? 'published' : 'draft'}
              />
            ) : (
              <StatusBadge label="DRAFT" tone="draft" />
            )}
            <StatusBadge label={sourceMode} tone="neutral" />
          </div>
          <p className="text-sm text-muted">
            Saving creates a new draft revision.
            {publishedRevision
              ? ` Latest published: #${publishedRevision.revisionNumber}.`
              : ' No published revision yet.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {onOpenHistory ? (
            <Button type="button" variant="secondary" onClick={onOpenHistory}>
              <History size={16} /> Revision history
            </Button>
          ) : null}
          {canPublish && currentRevision ? (
            <Button type="button" disabled={isPublishing} onClick={() => onPublish?.(currentRevision.id)}>
              <Rocket size={16} /> {isPublishing ? 'Publishing...' : 'Publish'}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
