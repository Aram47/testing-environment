import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Pause, Play } from 'lucide-react';
import type { TestRunEvent } from '../../types';
import { Button } from '../../components/ui/Button';
import { Format } from '../../lib/format';
import { testRunEventMessage } from '../../lib/testRunEvent';
import { useRunLogChunks } from '../../api/hooks/useRunLogs';
import type { RunnerLog } from '../../types';

interface LogLine {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  kind: 'event' | 'log';
}

interface LogsViewerProps {
  projectId: string;
  runId: string;
  events: TestRunEvent[];
}

export function LogsViewer({ projectId, runId, events }: LogsViewerProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const parentRef = useRef<HTMLDivElement | null>(null);
  const logsQuery = useRunLogChunks(projectId, runId);

  const restLogs = useMemo(
    () => logsQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [logsQuery.data?.pages],
  );

  const lines = useMemo(() => mergeLogLines(events, restLogs), [events, restLogs]);

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
      if (distanceToBottom < 40 && hasNextPage && !isFetchingNextPage) {
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
      <div
        ref={parentRef}
        className="mt-3 h-80 overflow-y-auto font-mono text-xs text-slate-200"
        aria-live="polite"
      >
        {!lines.length ? (
          <p className="text-slate-400">No logs yet.</p>
        ) : (
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map((item) => {
              const line = lines[item.index];
              return (
                <p
                  key={line.id}
                  className="absolute left-0 top-0 w-full pr-2"
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  <span className="text-slate-400">{Format.date(line.timestamp)}</span>{' '}
                  <span className={line.kind === 'event' ? 'text-blue-300' : 'text-emerald-300'}>
                    [{line.level}]
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
    message: testRunEventMessage(event),
    kind: 'event',
  }));
  const logLines: LogLine[] = logs.map((log) => ({
    id: `log-${log.id}`,
    timestamp: log.timestamp,
    level: log.level,
    message: log.message,
    kind: 'log',
  }));
  return [...eventLines, ...logLines].sort(
    (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
  );
}
