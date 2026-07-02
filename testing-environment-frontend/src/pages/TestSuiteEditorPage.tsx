import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { testSuitesApi, type TestSuiteInput } from '../api/test-suites.api';
import { ConfirmDialog } from '../components/modals/ConfirmDialog';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../components/ui/toastContext';
import { TestSuiteEditor } from '../features/test-suites/TestSuiteEditor';
import { ErrorPresenter } from '../lib/errors';

export function TestSuiteEditorPage({ mode }: { mode: 'new' | 'edit' }) {
  const { projectId = '', suiteId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const suiteQuery = useQuery({
    queryKey: ['test-suites', projectId, suiteId],
    queryFn: () => testSuitesApi.get(projectId, suiteId),
    enabled: mode === 'edit',
  });
  const saveMutation = useMutation({
    mutationFn: (input: TestSuiteInput) =>
      mode === 'new' ? testSuitesApi.create(projectId, input) : testSuitesApi.update(projectId, suiteId, input),
    onSuccess: async (suite) => {
      showToast('Test suite saved', 'success');
      await queryClient.invalidateQueries({ queryKey: ['test-suites', projectId] });
      navigate(`/projects/${projectId}/test-suites/${suite.id}`);
    },
    onError: (error) => showToast(ErrorPresenter.message(error), 'error'),
  });
  const deleteMutation = useMutation({
    mutationFn: () => testSuitesApi.remove(projectId, suiteId),
    onSuccess: async () => {
      showToast('Test suite deleted', 'success');
      await queryClient.invalidateQueries({ queryKey: ['test-suites', projectId] });
      navigate(`/projects/${projectId}/test-suites`);
    },
    onError: (error) => showToast(ErrorPresenter.message(error), 'error'),
  });

  if (suiteQuery.isLoading) {
    return <LoadingState label="Loading suite" />;
  }

  if (suiteQuery.isError) {
    return <ErrorState error={suiteQuery.error} />;
  }

  return (
    <>
      <PageHeader title={mode === 'new' ? 'New test suite' : 'Edit test suite'} description="Write request flows and expectations in YAML." />
      <TestSuiteEditor
        projectId={projectId}
        value={suiteQuery.data}
        isSaving={saveMutation.isPending}
        onSave={(value) => saveMutation.mutate(value)}
        onDelete={mode === 'edit' ? () => setDeleteOpen(true) : undefined}
        onBack={() => navigate(`/projects/${projectId}/test-suites`)}
        onMessage={showToast}
      />
      <ConfirmDialog
        open={deleteOpen}
        title="Delete test suite"
        description="This suite will be removed permanently."
        confirmLabel={deleteMutation.isPending ? 'Deleting...' : 'Delete'}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
      />
    </>
  );
}
