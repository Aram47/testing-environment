import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Download, RotateCcw, Square } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { reportsApi } from '../api/reports.api';
import {
  invalidateTestRunQueries,
  useCancelTestRun,
  useCreateTestRun,
  useTestRun,
} from '../api/hooks/useTestRuns';
import { useTestRunEvents } from '../api/hooks/useTestRunEvents';
import { Button } from '../components/ui/Button';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../components/ui/toastContext';
import { TestResultDetailsDrawer } from '../features/test-runs/TestResultDetailsDrawer';
import { TestRunProgress } from '../features/test-runs/TestRunProgress';
import { TestRunTimeline } from '../features/test-runs/TestRunTimeline';
import { ErrorPresenter } from '../lib/errors';
import { Format } from '../lib/format';
import { TestResultsTable } from '../tables/TestResultsTable';
import type { RunStatus, TestResult } from '../types';
import { useQueryClient } from '@tanstack/react-query';

const LogsViewer = lazy(() =>
  import('../features/test-runs/LogsViewer').then((module) => ({ default: module.LogsViewer })),
);
const FlowSuiteEditor = lazy(() =>
  import('../features/test-suites/FlowSuiteEditor').then((module) => ({ default: module.FlowSuiteEditor })),
);

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
  const [selectedResult, setSelectedResult] = useState<TestResult | null>(null);
  const runQuery = useTestRun(projectId, runId);
  const { events, connectionState } = useTestRunEvents(projectId, runId);
  const processedSequenceRef = useRef(0);
  const connectionErrorNotifiedRef = useRef(false);

  useEffect(() => {
    if (connectionState === 'error') {
      if (!connectionErrorNotifiedRef.current) {
        connectionErrorNotifiedRef.current = true;
        showToast('Live connection interrupted', 'error');
      }
      return;
    }
    connectionErrorNotifiedRef.current = false;
  }, [connectionState, showToast]);

  useEffect(() => {
    const latest = events[events.length - 1];
    if (!latest || latest.sequence <= processedSequenceRef.current) {
      return;
    }
    processedSequenceRef.current = latest.sequence;
    if (latest.type === 'logs.updated') {
      void queryClient.invalidateQueries({ queryKey: ['logs', projectId, runId, 'chunks'] });
    }
    if (latest.type === 'run.finished') {
      void invalidateTestRunQueries(queryClient, projectId, runId);
    }
  }, [events, projectId, queryClient, runId]);

  const runAgainMutation = useCreateTestRun(projectId);
  const cancelMutation = useCancelTestRun(projectId, runId);

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
  const junitDownloadMutation = useMutation({
    mutationFn: () => reportsApi.junit(projectId, runId),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `test-run-${runId}.xml`;
      link.click();
      URL.revokeObjectURL(url);
    },
    onError: (error) => showToast(ErrorPresenter.message(error), 'error'),
  });
  const artifactDownloadMutation = useMutation({
    mutationFn: (artifactId: string) => reportsApi.artifact(projectId, runId, artifactId),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `test-run-${runId}-response.json`;
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
  const flowSnapshot = run.suiteRevisions?.find((snapshot) => snapshot.testSuiteRevision.visualFlow)?.testSuiteRevision;
  const visualFlow = flowSnapshot?.visualFlow;
  const executionResults = results.reduce<Record<string, TestResult>>((accumulator, result) => {
    if (result.stepId) {
      accumulator[result.stepId] = result;
    }
    return accumulator;
  }, {});

  return (
    <>
      <PageHeader
        title={`Run ${run.id}`}
        description={`${run.startedAt ? `Started ${Format.date(run.startedAt)}` : `Queued ${Format.date(run.queuedAt ?? run.enqueuedAt)}`}. Duration ${Format.duration(run.durationMs)}.`}
        action={
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={() => runAgainMutation.mutate(undefined, {
                onSuccess: (createdRun) => navigate(`/projects/${projectId}/runs/${createdRun.id}`),
                onError: (error) => showToast(ErrorPresenter.message(error), 'error'),
              })}
              disabled={runAgainMutation.isPending}
            >
              <RotateCcw size={18} /> Run again
            </Button>
            {cancellableStatuses.has(run.status) ? (
              <Button
                variant="danger"
                onClick={() => cancelMutation.mutate(undefined, {
                  onSuccess: async () => {
                    showToast('Run cancelled', 'success');
                    await invalidateTestRunQueries(queryClient, projectId, runId);
                  },
                  onError: (error) => showToast(ErrorPresenter.message(error), 'error'),
                })}
                disabled={cancelMutation.isPending}
              >
                <Square size={18} /> Cancel run
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => downloadMutation.mutate()} disabled={downloadMutation.isPending}>
              <Download size={18} /> Download JSON
            </Button>
            <Button variant="secondary" onClick={() => junitDownloadMutation.mutate()} disabled={junitDownloadMutation.isPending}>
              <Download size={18} /> JUnit XML
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
        <TestRunProgress run={run} connectionState={connectionState} />
        {visualFlow ? (
          <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-ink">Flow view</h2>
            <Suspense fallback={<LoadingState label="Loading flow view" />}>
              <FlowSuiteEditor
                projectId={projectId}
                suiteName={flowSnapshot?.visualFlow?.suiteName ?? visualFlow.suiteName}
                initialFlow={visualFlow}
                initialYaml={flowSnapshot?.compiledYaml ?? ''}
                readOnly
                executionResults={executionResults}
                onSave={() => undefined}
                onMessage={() => undefined}
              />
            </Suspense>
          </section>
        ) : null}
        <TestRunTimeline results={results} />
        <Suspense fallback={<LoadingState label="Loading logs viewer" />}>
          <LogsViewer projectId={projectId} runId={runId} events={events} />
        </Suspense>
        {results.length ? (
          <TestResultsTable results={results} onSelect={setSelectedResult} />
        ) : (
          <section className="rounded-lg border border-border bg-white p-6 text-sm text-muted">No test results yet.</section>
        )}
      </div>
      <TestResultDetailsDrawer
        result={selectedResult}
        onClose={() => setSelectedResult(null)}
        onDownloadResponse={(artifactId) => artifactDownloadMutation.mutate(artifactId)}
      />
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
