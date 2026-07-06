import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Download, RotateCcw, Square } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { reportsApi } from '../api/reports.api';
import {
  invalidateTestRunQueries,
  useCancelTestRun,
  useCreateTestRun,
  useTestRunComparison,
  useTestRunDetail,
} from '../api/hooks/useTestRuns';
import { useTestRunEvents } from '../api/hooks/useTestRunEvents';
import { Button } from '../components/ui/Button';
import { CopyButton } from '../components/ui/CopyButton';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../components/ui/toastContext';
import { FailureInspector } from '../features/test-runs/FailureInspector';
import { getFailureFocusTimeRange } from '../features/test-runs/failureFocus';
import { PhaseDurationChart } from '../features/test-runs/PhaseDurationChart';
import { PhaseTimeline } from '../features/test-runs/PhaseTimeline';
import { RunComparisonPanel } from '../features/test-runs/RunComparisonPanel';
import { RunSummaryHeader } from '../features/test-runs/RunSummaryHeader';
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

const TERMINAL_STATUSES: ReadonlySet<RunStatus> = new Set([
  'PASSED',
  'TEST_FAILED',
  'INFRA_FAILED',
  'TIMED_OUT',
  'CANCELLED',
]);

export function TestRunDetailPage() {
  const { projectId = '', runId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const runQuery = useTestRunDetail(projectId, runId);
  const comparisonQuery = useTestRunComparison(
    projectId,
    runId,
    Boolean(runQuery.data && TERMINAL_STATUSES.has(runQuery.data.status)),
  );
  const { events, connectionState } = useTestRunEvents(projectId, runId);
  const processedSequenceRef = useRef(0);
  const connectionErrorNotifiedRef = useRef(false);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);

  const run = runQuery.data;
  const results = useMemo(() => run?.results ?? [], [run?.results]);
  const selectedResult = useMemo(
    () => results.find((result) => result.id === selectedResultId) ?? null,
    [results, selectedResultId],
  );

  useEffect(() => {
    if (!run?.diagnosis.primaryFailure?.testResultId || selectedResultId) {
      return;
    }
    if (TERMINAL_STATUSES.has(run.status) && run.status !== 'PASSED') {
      setSelectedResultId(run.diagnosis.primaryFailure.testResultId);
    }
  }, [run, selectedResultId]);

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
    if (latest.type === 'test.passed' || latest.type === 'test.failed') {
      void queryClient.invalidateQueries({ queryKey: ['test-runs', projectId, runId, 'detail'] });
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

  if (!run) {
    return <ErrorState error={new Error('Test run data is empty')} />;
  }

  const flowSnapshot = run.suiteRevisions?.find((snapshot) => snapshot.testSuiteRevision.visualFlow)?.testSuiteRevision;
  const visualFlow = flowSnapshot?.visualFlow;
  const executionResults = results.reduce<Record<string, TestResult>>((accumulator, result) => {
    if (result.stepId) {
      accumulator[result.stepId] = result;
    }
    return accumulator;
  }, {});
  const focusTimeRange = getFailureFocusTimeRange(selectedResult?.createdAt);
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <>
      <PageHeader
        title={`Run ${run.id}`}
        description={`${run.startedAt ? `Started ${Format.date(run.startedAt)}` : `Queued ${Format.date(run.queuedAt ?? run.enqueuedAt)}`}. Duration ${Format.duration(run.durationMs)}.`}
        action={
          <div className="flex flex-wrap gap-3">
            <CopyButton value={shareUrl} label="Copy link" className="min-h-10" />
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
        <RunSummaryHeader run={run} connectionState={connectionState} />
        <PhaseTimeline phases={run.phaseTimeline} />
        <PhaseDurationChart phases={run.phaseTimeline} />
        {run.diagnosis.primaryFailure ? (
          <FailureInspector
            diagnosis={run.diagnosis}
            result={selectedResult}
            onDownloadResponse={(artifactId) => artifactDownloadMutation.mutate(artifactId)}
          />
        ) : null}
        {comparisonQuery.data ? (
          <RunComparisonPanel comparison={comparisonQuery.data} projectId={projectId} />
        ) : comparisonQuery.isLoading ? (
          <LoadingState label="Loading comparison" />
        ) : null}
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
        {results.length ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Test results</h2>
            <TestResultsTable
              results={results}
              onSelect={(result) => setSelectedResultId(result.id)}
              selectedResultId={selectedResultId ?? undefined}
              primaryFailureResultId={run.diagnosis.primaryFailure?.testResultId ?? undefined}
            />
          </section>
        ) : (
          <section className="rounded-lg border border-border bg-white p-6 text-sm text-muted">No test results yet.</section>
        )}
        <Suspense fallback={<LoadingState label="Loading logs viewer" />}>
          <LogsViewer
            projectId={projectId}
            runId={runId}
            events={events}
            focusTimeRange={focusTimeRange}
          />
        </Suspense>
      </div>
    </>
  );
}
