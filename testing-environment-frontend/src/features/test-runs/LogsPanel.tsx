import type { RunnerLog, TestRunEvent } from '../../types';
import { Format } from '../../lib/format';

export function LogsPanel({ logs, events }: { logs: RunnerLog[]; events: TestRunEvent[] }) {
  return (
    <section className="rounded-lg border border-border bg-slate-950 p-4">
      <h2 className="text-sm font-semibold text-slate-100">Live logs</h2>
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto font-mono text-xs text-slate-200">
        {events.map((event, index) => (
          <p key={`${event.timestamp}-${index}`}>
            <span className="text-blue-300">{event.type}</span> {event.message}
          </p>
        ))}
        {logs.map((log) => (
          <p key={log.id}>
            <span className="text-slate-400">{Format.date(log.timestamp)}</span> [{log.level}] {log.message}
          </p>
        ))}
        {!events.length && !logs.length ? <p className="text-slate-400">No logs yet.</p> : null}
      </div>
    </section>
  );
}
