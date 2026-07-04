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
import type { TestResult, TestRunEvent } from '../types';

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
        description={`Started ${Format.date(run.startedAt)}. Duration ${Format.duration(run.durationMs)}.`}
        action={
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => runAgainMutation.mutate()} disabled={runAgainMutation.isPending}>
              <RotateCcw size={18} /> Run again
            </Button>
            {run.status === 'RUNNING' ? (
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
