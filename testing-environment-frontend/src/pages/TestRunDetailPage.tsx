import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, RotateCcw, Square } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { reportsApi } from '../api/reports.api';
import { TestRunEventsClient } from '../api/test-run-events.client';
import { testRunsApi } from '../api/test-runs.api';
import { Button } from '../components/ui/Button';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../components/ui/toastContext';
import { LogsPanel } from '../features/test-runs/LogsPanel';
import { TestResultDetailsDrawer } from '../features/test-runs/TestResultDetailsDrawer';
import { TestRunProgress } from '../features/test-runs/TestRunProgress';
import { TestRunTimeline } from '../features/test-runs/TestRunTimeline';
import { ErrorPresenter } from '../lib/errors';
import { Format } from '../lib/format';
import { TestResultsTable } from '../tables/TestResultsTable';
import type { RunStatus, TestResult, TestRunEvent } from '../types';

const cancellableStatuses: ReadonlySet<RunStatus> = new Set([
  'QUEUED',
  'CLAIMED',
  'PREPARING_WORKSPACE',
  'VALIDATING_ENVIRONMENT',
  'PULLING_IMAGES',
  'STARTING_ENVIRONMENT',
  'WAITING_FOR_HEALTHCHECK',
  'EXECUTING_TESTS',
  'COLLECTING_ARTIFACTS',
  'CLEANING_UP',
]);

export function TestRunDetailPage() {
  const { projectId = '', runId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [events, setEvents] = useState<TestRunEvent[]>([]);
  const [selectedResult, setSelectedResult] = useState<TestResult | null>(null);
  const runQuery = useQuery({ queryKey: ['test-runs', projectId, runId], queryFn: () => testRunsApi.get(projectId, runId) });
  const logsQuery = useQuery({ queryKey: ['logs', projectId, runId], queryFn: () => reportsApi.logs(projectId, runId), enabled: Boolean(runId) });
  const wsClient = useMemo(() => new TestRunEventsClient(), []);

  useEffect(() => {
    if (!runId) {
      return undefined;
    }

    return wsClient.connect(
      runId,
      (event) => {
        setEvents((items) => [...items, event]);
        if (event.type === 'logs.updated') {
          void queryClient.invalidateQueries({ queryKey: ['logs', projectId, runId] });
        }
        if (event.type === 'run.finished') {
          void queryClient.invalidateQueries({ queryKey: ['test-runs', projectId, runId] });
          void queryClient.invalidateQueries({ queryKey: ['logs', projectId, runId] });
        }
      },
      () => showToast('Live connection interrupted', 'error'),
    );
  }, [projectId, queryClient, runId, showToast, wsClient]);

  const runAgainMutation = useMutation({
    mutationFn: () => testRunsApi.create(projectId),
    onSuccess: (run) => navigate(`/projects/${projectId}/runs/${run.id}`),
    onError: (error) => showToast(ErrorPresenter.message(error), 'error'),
  });
  const cancelMutation = useMutation({
    mutationFn: () => testRunsApi.cancel(projectId, runId),
    onSuccess: async () => {
      showToast('Run cancelled', 'success');
      await queryClient.invalidateQueries({ queryKey: ['test-runs', projectId, runId] });
    },
    onError: (error) => showToast(ErrorPresenter.message(error), 'error'),
  });
  const downloadMutation = useMutation({
    mutationFn: () => reportsApi.report(projectId, runId),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `test-run-${runId}.json`;
      link.click();
      URL.revokeObjectURL(url);
    },
    onError: (error) => showToast(ErrorPresenter.message(error), 'error'),
  });

  if (runQuery.isLoading) {
    return <LoadingState label="Loading run" />;
  }

  if (runQuery.isError) {
    return <ErrorState error={runQuery.error} />;
  }

  const run = runQuery.data;
  if (!run) {
    return <ErrorState error={new Error('Test run data is empty')} />;
  }
  const results = run.results ?? [];

  return (
    <>
      <PageHeader
        title={`Run ${run.id}`}
        description={`${run.startedAt ? `Started ${Format.date(run.startedAt)}` : `Queued ${Format.date(run.queuedAt ?? run.enqueuedAt)}`}. Duration ${Format.duration(run.durationMs)}.`}
        action={
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => runAgainMutation.mutate()} disabled={runAgainMutation.isPending}>
              <RotateCcw size={18} /> Run again
            </Button>
            {cancellableStatuses.has(run.status) ? (
              <Button variant="danger" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
                <Square size={18} /> Cancel run
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => downloadMutation.mutate()} disabled={downloadMutation.isPending}>
              <Download size={18} /> Download JSON
            </Button>
          </div>
        }
      />
      <div className="space-y-6">
        <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-ink">Execution snapshot</h2>
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
            <SnapshotItem
              label="Environment"
              value={
                run.environmentConfigRevision
                  ? `Revision #${run.environmentConfigRevision.revisionNumber}`
                  : run.environmentConfigRevisionId ?? 'Not recorded'
              }
            />
            <SnapshotItem label="Runner" value={run.runnerVersion ?? 'local'} />
            <SnapshotItem label="Report schema" value={String(run.reportSchemaVersion ?? 1)} />
          </dl>
          {run.suiteRevisions?.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {run.suiteRevisions.map((snapshot) => (
                <article key={snapshot.id} className="rounded-md border border-border p-3 text-sm">
                  <div className="font-semibold text-ink">{snapshot.suiteName}</div>
                  <div className="text-muted">Revision #{snapshot.testSuiteRevision.revisionNumber}</div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
        <TestRunProgress run={run} />
        <TestRunTimeline results={results} />
        <LogsPanel logs={logsQuery.data ?? []} events={events} />
        {results.length ? (
          <TestResultsTable results={results} onSelect={setSelectedResult} />
        ) : (
          <section className="rounded-lg border border-border bg-white p-6 text-sm text-muted">No test results yet.</section>
        )}
      </div>
      <TestResultDetailsDrawer result={selectedResult} onClose={() => setSelectedResult(null)} />
    </>
  );
}

function SnapshotItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-muted">{label}</dt>
      <dd className="mt-1 font-medium text-ink">{value}</dd>
    </div>
  );
}
