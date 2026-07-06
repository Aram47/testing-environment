import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Pause, Play } from 'lucide-react';
import type { RunnerLog, TestRunEvent } from '../../types';
import { Button } from '../../components/ui/Button';
import { Format } from '../../lib/format';
import { testRunEventMessage } from '../../lib/testRunEvent';
import { useRunLogChunks } from '../../api/hooks/useRunLogs';

type LogSourceFilter = 'ALL' | 'SYSTEM' | 'DOCKER' | 'ERROR' | 'TEST' | 'EVENTS';

interface LogLine {
  id: string;
  timestamp: string;
  level: string;
  source?: RunnerLog['source'] | 'EVENT';
  message: string;
  kind: 'event' | 'log';
}

interface LogsViewerProps {
  projectId: string;
  runId: string;
  events: TestRunEvent[];
  focusTimeRange?: { from: number; to: number };
}

const SOURCE_FILTERS: LogSourceFilter[] = ['ALL', 'SYSTEM', 'DOCKER', 'ERROR', 'TEST', 'EVENTS'];

export function LogsViewer({ projectId, runId, events, focusTimeRange }: LogsViewerProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<LogSourceFilter>('ALL');
  const parentRef = useRef<HTMLDivElement | null>(null);
  const logsQuery = useRunLogChunks(projectId, runId);

  const restLogs = useMemo(
    () => logsQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [logsQuery.data?.pages],
  );

  const allLines = useMemo(() => mergeLogLines(events, restLogs), [events, restLogs]);
  const lines = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allLines.filter((line) => {
      if (sourceFilter === 'EVENTS' && line.kind !== 'event') {
        return false;
      }
      if (sourceFilter !== 'ALL' && sourceFilter !== 'EVENTS' && line.source !== sourceFilter) {
        return false;
      }
      if (query && !line.message.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });
  }, [allLines, search, sourceFilter]);

  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 12,
  });

  useEffect(() => {
    if (!autoScroll || !lines.length) {
      return;
    }
    virtualizer.scrollToIndex(lines.length - 1, { align: 'end' });
  }, [autoScroll, lines.length, virtualizer]);

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = logsQuery;

  useEffect(() => {
    const element = parentRef.current;
    if (!element) {
      return undefined;
    }

    const onScroll = () => {
      const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
      if (distanceToBottom > 80) {
        setAutoScroll(false);
      }
      if (element.scrollTop < 40 && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    };

    element.addEventListener('scroll', onScroll);
    return () => element.removeEventListener('scroll', onScroll);
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <section className="rounded-lg border border-border bg-slate-950 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-100">Live logs</h2>
        <Button
          variant="secondary"
          className="min-h-9 bg-slate-900 text-slate-100"
          onClick={() => {
            setAutoScroll((current) => {
              const next = !current;
              if (next && lines.length) {
                requestAnimationFrame(() => virtualizer.scrollToIndex(lines.length - 1, { align: 'end' }));
              }
              return next;
            });
          }}
        >
          {autoScroll ? <Pause size={16} /> : <Play size={16} />}
          {autoScroll ? 'Pause auto-scroll' : 'Resume auto-scroll'}
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search logs"
          className="min-h-9 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100"
        />
        <div className="flex flex-wrap gap-2">
          {SOURCE_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                sourceFilter === filter
                  ? 'bg-slate-100 text-slate-900'
                  : 'bg-slate-800 text-slate-300'
              }`}
              onClick={() => setSourceFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={parentRef}
        className="mt-3 h-80 overflow-y-auto font-mono text-xs text-slate-200"
        aria-live="polite"
      >
        {!lines.length ? (
          <p className="text-slate-400">No logs match the current filters.</p>
        ) : (
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map((item) => {
              const line = lines[item.index];
              const timestamp = new Date(line.timestamp).getTime();
              const highlighted =
                focusTimeRange &&
                timestamp >= focusTimeRange.from &&
                timestamp <= focusTimeRange.to;
              return (
                <p
                  key={line.id}
                  className={`absolute left-0 top-0 w-full pr-2 ${highlighted ? 'rounded bg-amber-500/10' : ''}`}
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  <span className="text-slate-400">{Format.date(line.timestamp)}</span>{' '}
                  <span className={line.kind === 'event' ? 'text-blue-300' : 'text-emerald-300'}>
                    [{line.source ?? line.level}]
                  </span>{' '}
                  {line.message}
                </p>
              );
            })}
          </div>
        )}
      </div>
      {logsQuery.isFetchingNextPage ? (
        <p className="mt-2 text-xs text-slate-400">Loading older logs…</p>
      ) : null}
    </section>
  );
}

function mergeLogLines(events: TestRunEvent[], logs: RunnerLog[]): LogLine[] {
  const eventLines: LogLine[] = events.map((event) => ({
    id: `event-${event.sequence}`,
    timestamp: event.timestamp,
    level: event.type,
    source: 'EVENT',
    message: testRunEventMessage(event),
    kind: 'event',
  }));
  const logLines: LogLine[] = logs.map((log) => ({
    id: `log-${log.id}`,
    timestamp: log.timestamp,
    level: log.level,
    source: log.source,
    message: log.message,
    kind: 'log',
  }));
  return [...eventLines, ...logLines].sort(
    (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
  );
}
