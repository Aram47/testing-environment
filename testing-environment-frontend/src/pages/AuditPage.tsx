import { useQuery } from '@tanstack/react-query';
import { auditApi } from '../api/audit.api';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';

export function AuditPage() {
  const query = useQuery({ queryKey: ['audit-events'], queryFn: () => auditApi.list() });

  if (query.isLoading) {
    return <LoadingState label="Loading audit log" />;
  }

  if (query.isError) {
    return <ErrorState error={query.error} />;
  }

  const events = query.data ?? [];

  return (
    <>
      <PageHeader title="Audit log" description="Recent workspace actions for compliance and troubleshooting." />
      <section className="rounded-lg border border-border bg-white shadow-sm">
        {events.length === 0 ? (
          <p className="p-6 text-sm text-muted">No audit events recorded yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Resource</th>
                <th className="px-4 py-3 font-medium">Actor</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-muted">{new Date(event.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium text-ink">{event.action}</td>
                  <td className="px-4 py-3 text-muted">
                    {event.resourceType ?? '—'}
                    {event.resourceId ? ` / ${event.resourceId}` : ''}
                  </td>
                  <td className="px-4 py-3 text-muted">{event.actorUserId ?? event.actorType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
