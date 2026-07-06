import type { ConnectionState } from '../../api/test-run-events.client';

const labels: Record<ConnectionState, string> = {
  connecting: 'Connecting…',
  connected: 'Live',
  reconnecting: 'Reconnecting…',
  disconnected: 'Disconnected',
  error: 'Connection error',
};

const styles: Record<ConnectionState, string> = {
  connecting: 'bg-amber-100 text-amber-900',
  connected: 'bg-emerald-100 text-emerald-900',
  reconnecting: 'bg-amber-100 text-amber-900',
  disconnected: 'bg-red-100 text-red-900',
  error: 'bg-red-100 text-red-900',
};

const staleHint = 'Events may be stale until the connection recovers.';

export function ConnectionStateBadge({ state }: { state: ConnectionState }) {
  const showStaleHint = state === 'disconnected' || state === 'error';

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${styles[state]}`}
        title={showStaleHint ? staleHint : undefined}
      >
        {labels[state]}
      </span>
      {showStaleHint ? (
        <span className="text-xs text-red-700">{staleHint}</span>
      ) : null}
    </span>
  );
}
