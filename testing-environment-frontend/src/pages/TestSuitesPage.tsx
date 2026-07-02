import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { testSuitesApi } from '../api/test-suites.api';
import { Button } from '../components/ui/Button';
import { LinkButton } from '../components/ui/LinkButton';
import { ConfirmDialog } from '../components/modals/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../components/ui/toastContext';
import { ErrorPresenter } from '../lib/errors';
import { Format } from '../lib/format';
import type { TestSuite } from '../types';

export function TestSuitesPage() {
  const { projectId = '' } = useParams();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [suiteToDelete, setSuiteToDelete] = useState<TestSuite | null>(null);
  const query = useQuery({ queryKey: ['test-suites', projectId], queryFn: () => testSuitesApi.list(projectId) });
  const deleteMutation = useMutation({
    mutationFn: (suiteId: string) => testSuitesApi.remove(projectId, suiteId),
    onSuccess: async () => {
      showToast('Test suite deleted', 'success');
      setSuiteToDelete(null);
      await queryClient.invalidateQueries({ queryKey: ['test-suites', projectId] });
    },
    onError: (error) => showToast(ErrorPresenter.message(error), 'error'),
  });

  if (query.isLoading) {
    return <LoadingState label="Loading suites" />;
  }

  if (query.isError) {
    return <ErrorState error={query.error} />;
  }

  const suites = query.data;
  if (!suites) {
    return <ErrorState error={new Error('Test suites data is empty')} />;
  }

  return (
    <>
      <PageHeader
        title="Test suites"
        description="YAML suites that define requests, expectations, saved variables, and assertions."
        action={<LinkButton to={`/projects/${projectId}/test-suites/new`}>New suite</LinkButton>}
      />
      {!suites.length ? (
        <EmptyState
          title="No test suites"
          description="Create a YAML suite to start testing your backend API."
          action={<LinkButton to={`/projects/${projectId}/test-suites/new`}>Create suite</LinkButton>}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {suites.map((suite) => (
            <article key={suite.id} className="rounded-lg border border-border bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-ink">{suite.name}</h2>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <Info label="Tests" value={String(suite.testsCount ?? 'Unknown')} />
                <Info label="Updated" value={Format.date(suite.updatedAt)} />
              </dl>
              <div className="mt-5 flex justify-end gap-3">
                <LinkButton variant="secondary" to={`/projects/${projectId}/test-suites/${suite.id}`}>Edit</LinkButton>
                <Button variant="danger" onClick={() => setSuiteToDelete(suite)}>Delete</Button>
              </div>
            </article>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(suiteToDelete)}
        title="Delete test suite"
        description={`Delete ${suiteToDelete?.name ?? 'this suite'}? This action cannot be undone.`}
        confirmLabel={deleteMutation.isPending ? 'Deleting...' : 'Delete'}
        onCancel={() => setSuiteToDelete(null)}
        onConfirm={() => suiteToDelete && deleteMutation.mutate(suiteToDelete.id)}
      />
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-muted">{label}</dt>
      <dd className="mt-1 font-medium text-ink">{value}</dd>
    </div>
  );
}
