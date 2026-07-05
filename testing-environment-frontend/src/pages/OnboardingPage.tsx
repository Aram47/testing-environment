import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, FileText, GitBranch, Play, Upload } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { onboardingApi, type ConfirmOnboardingInput } from '../api/onboarding.api';
import { testRunsApi } from '../api/test-runs.api';
import { Button } from '../components/ui/Button';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../components/ui/toastContext';
import { ErrorPresenter } from '../lib/errors';
import type {
  ComposeAnalysisResult,
  EnvironmentConfigType,
  EnvironmentImportSource,
  OnboardingDraftData,
  OnboardingProjectDraft,
  OnboardingStep,
  OnboardingTemplate,
  Project,
} from '../types';

const steps: OnboardingStep[] = ['project', 'environment', 'api-import', 'template', 'run'];

const projectSchema = z.object({
  name: z.string().min(2, 'Project name is required'),
  description: z.string().optional(),
  baseUrl: z.string().url('Enter a valid URL'),
  mainServiceName: z.string().min(1, 'Main service is required'),
  healthcheckPath: z.string().startsWith('/', 'Path must start with /'),
  healthcheckExpectedStatus: z.coerce.number().int().min(100).max(599),
  healthcheckTimeoutSeconds: z.coerce.number().int().min(1).max(600),
});

const defaultProject: OnboardingProjectDraft = {
  name: '',
  description: '',
  baseUrl: 'http://localhost:3000',
  mainServiceName: 'api',
  healthcheckPath: '/health',
  healthcheckExpectedStatus: 200,
  healthcheckTimeoutSeconds: 60,
};

export function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const sessionQuery = useQuery({ queryKey: ['onboarding-session'], queryFn: () => onboardingApi.session() });
  const templatesQuery = useQuery({ queryKey: ['onboarding-templates'], queryFn: () => onboardingApi.templates() });
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('project');
  const [draft, setDraft] = useState<OnboardingDraftData>({});
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [confirmedProject, setConfirmedProject] = useState<Project | null>(null);
  const [yamlError, setYamlError] = useState<string | null>(null);
  const form = useForm<OnboardingProjectDraft>({
    resolver: zodResolver(projectSchema),
    defaultValues: defaultProject,
    mode: 'onBlur',
  });

  useEffect(() => {
    if (!sessionQuery.data) {
      return;
    }
    const nextDraft = sessionQuery.data.draftData ?? {};
    setDraft(nextDraft);
    setCurrentStep(sessionQuery.data.currentStep ?? 'project');
    form.reset({ ...defaultProject, ...nextDraft.project });
  }, [form, sessionQuery.data]);

  const saveProgress = async (step = currentStep, nextDraft = draft) => {
    await onboardingApi.updateSession({ currentStep: step, draftData: nextDraft });
    await queryClient.invalidateQueries({ queryKey: ['onboarding-session'] });
  };

  const updateDraft = (patch: Partial<OnboardingDraftData>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    return next;
  };

  const analyzeMutation = useMutation({
    mutationFn: (input: {
      source: Extract<EnvironmentImportSource, 'UPLOAD' | 'PASTE' | 'TEMPLATE'>;
      composeYaml: string;
    }) => onboardingApi.analyzeCompose(input),
    onSuccess: async (analysis, input) => {
      setYamlError(null);
      const nextProject = projectFromAnalysis(form.getValues(), analysis);
      form.reset(nextProject);
      const next = updateDraft({
        importSource: input.source,
        environmentType: 'DOCKER_COMPOSE',
        composeYaml: input.composeYaml,
        analysis,
        project: nextProject,
      });
      await saveProgress('api-import', next);
      showToast('Compose analyzed', analysis.securityWarnings.length ? 'info' : 'success');
    },
    onError: (error) => setYamlError(ErrorPresenter.message(error)),
  });

  const confirmMutation = useMutation({
    mutationFn: (input: ConfirmOnboardingInput) => onboardingApi.confirm(input),
    onSuccess: async (result) => {
      setConfirmedProject(result.project);
      setCurrentStep('run');
      setIsConfirmed(true);
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await saveProgress('run', draft);
      showToast('Onboarding configuration saved', 'success');
    },
    onError: (error) => showToast(ErrorPresenter.message(error), 'error'),
  });

  const runMutation = useMutation({
    mutationFn: (projectId: string) => testRunsApi.create(projectId),
    onSuccess: (run) => {
      showToast('First test run started', 'success');
      navigate(`/projects/${run.projectId}/runs/${run.id}`);
    },
    onError: (error) => showToast(ErrorPresenter.message(error), 'error'),
  });

  const demoMutation = useMutation({
    mutationFn: () => onboardingApi.createDemoProject(),
    onSuccess: async (result) => {
      setConfirmedProject(result.project);
      setCurrentStep('run');
      setIsConfirmed(true);
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      showToast('Demo project created', 'success');
    },
    onError: (error) => showToast(ErrorPresenter.message(error), 'error'),
  });

  const selectedTemplate = useMemo(
    () => templatesQuery.data?.find((template) => template.id === draft.templateId),
    [draft.templateId, templatesQuery.data],
  );

  if (sessionQuery.isLoading || templatesQuery.isLoading) {
    return <LoadingState label="Loading onboarding" />;
  }

  if (sessionQuery.isError) {
    return <ErrorState error={sessionQuery.error} />;
  }

  const goToStep = async (step: OnboardingStep) => {
    const values = form.getValues();
    const next = updateDraft({ project: values });
    setCurrentStep(step);
    await saveProgress(step, next);
  };

  const continueFromProject = form.handleSubmit(async (values) => {
    const nextStep = draft.environmentType === 'DOCKER_COMPOSE' ? 'api-import' : 'environment';
    const next = updateDraft({ project: values });
    setCurrentStep(nextStep);
    await saveProgress(nextStep, next);
  });

  const selectTemplate = async (template: OnboardingTemplate) => {
    form.reset(template.project);
    let analysis: ComposeAnalysisResult | undefined;
    if (template.composeYaml) {
      try {
        analysis = await onboardingApi.analyzeCompose({
          source: 'TEMPLATE',
          composeYaml: template.composeYaml,
        });
        setYamlError(null);
      } catch (error) {
        setYamlError(ErrorPresenter.message(error));
        showToast(ErrorPresenter.message(error), 'error');
        return;
      }
    }
    const next = updateDraft({
      templateId: template.id,
      project: template.project,
      environmentType: template.environmentType,
      composeYaml: template.composeYaml,
      backendTestYaml: template.backendTestYaml,
      importSource: 'TEMPLATE',
      analysis,
    });
    setCurrentStep('run');
    await saveProgress('run', next);
  };

  const selectRunningEnvironment = async () => {
    const values = form.getValues();
    const next = updateDraft({
      environmentType: 'EXTERNAL_URL',
      importSource: 'RUNNING_ENVIRONMENT',
      project: values,
      composeYaml: undefined,
      analysis: undefined,
      backendTestYaml: backendTestYaml(),
    });
    setCurrentStep('run');
    await saveProgress('run', next);
  };

  const confirm = form.handleSubmit((values) => {
    if (!isConfirmed) {
      showToast('Confirm the detected result before saving', 'error');
      return;
    }
    confirmMutation.mutate({
      project: values,
      environmentType: draft.environmentType ?? 'DOCKER_COMPOSE',
      composeYaml: draft.composeYaml,
      backendTestYaml: draft.backendTestYaml ?? backendTestYaml(),
      analysis: draft.analysis,
      templateId: draft.templateId,
    });
  });

  return (
    <>
      <PageHeader
        title="Onboarding"
        description="Create a project, import an environment, confirm the result, and start the first run."
        action={
          <Button type="button" variant="secondary" onClick={() => demoMutation.mutate()} disabled={demoMutation.isPending}>
            Create demo project
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <StepList currentStep={currentStep} onSelect={(step) => void goToStep(step)} />

        <section className="rounded-lg border border-border bg-white p-6 shadow-sm">
          {currentStep === 'project' ? (
            <ProjectStep form={form} onContinue={() => void continueFromProject()} />
          ) : null}

          {currentStep === 'environment' ? (
            <EnvironmentStep
              onPaste={() => void goToStep('api-import')}
              onTemplate={() => void goToStep('template')}
              onExternal={() => void selectRunningEnvironment()}
            />
          ) : null}

          {currentStep === 'api-import' ? (
            <ApiImportStep
              composeYaml={draft.composeYaml ?? ''}
              analysis={draft.analysis}
              yamlError={yamlError}
              isAnalyzing={analyzeMutation.isPending}
              onAnalyze={(composeYaml, source) => analyzeMutation.mutate({ composeYaml, source })}
              onComposeChange={(composeYaml) => setDraft((value) => ({ ...value, composeYaml }))}
              onContinue={() => void goToStep('run')}
            />
          ) : null}

          {currentStep === 'template' ? (
            <TemplateStep
              templates={templatesQuery.data ?? []}
              selectedTemplate={selectedTemplate}
              onSelect={(template) => void selectTemplate(template)}
            />
          ) : null}

          {currentStep === 'run' ? (
            <RunStep
              analysis={draft.analysis}
              environmentType={draft.environmentType ?? 'DOCKER_COMPOSE'}
              project={form.getValues()}
              confirmedProject={confirmedProject}
              isConfirmed={isConfirmed}
              isSaving={confirmMutation.isPending}
              isRunning={runMutation.isPending}
              onConfirmedChange={setIsConfirmed}
              onBack={() => void goToStep(draft.importSource === 'TEMPLATE' ? 'template' : 'api-import')}
              onSave={() => void confirm()}
              onRun={() => {
                const projectId = confirmedProject?.id ?? sessionQuery.data?.projectId;
                if (projectId) {
                  runMutation.mutate(projectId);
                }
              }}
            />
          ) : null}
        </section>
      </div>
    </>
  );
}

function StepList({ currentStep, onSelect }: { currentStep: OnboardingStep; onSelect: (step: OnboardingStep) => void }) {
  return (
    <nav aria-label="Onboarding steps" className="rounded-lg border border-border bg-white p-3 shadow-sm">
      {steps.map((step, index) => (
        <button
          key={step}
          type="button"
          className={`focus-ring flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm font-semibold ${
            currentStep === step ? 'bg-brand text-white' : 'text-muted hover:bg-page hover:text-ink'
          }`}
          onClick={() => onSelect(step)}
        >
          <span>{index + 1}</span>
          <span>{stepLabel(step)}</span>
        </button>
      ))}
    </nav>
  );
}

function ProjectStep({
  form,
  onContinue,
}: {
  form: ReturnType<typeof useForm<OnboardingProjectDraft>>;
  onContinue: () => void;
}) {
  const { register, formState } = form;
  const errors = formState.errors;
  return (
    <form className="grid gap-5" onSubmit={(event) => event.preventDefault()}>
      <h1 className="text-xl font-semibold text-ink">Project</h1>
      <Field label="Project name" error={errors.name?.message}>
        <input className="input" autoComplete="off" {...register('name')} />
      </Field>
      <Field label="Description" error={errors.description?.message}>
        <textarea className="input min-h-24" {...register('description')} />
      </Field>
      <Field label="Base URL" error={errors.baseUrl?.message}>
        <input className="input" inputMode="url" {...register('baseUrl')} />
      </Field>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Main service" error={errors.mainServiceName?.message}>
          <input className="input" {...register('mainServiceName')} />
        </Field>
        <Field label="Healthcheck path" error={errors.healthcheckPath?.message}>
          <input className="input" {...register('healthcheckPath')} />
        </Field>
        <Field label="Expected status" error={errors.healthcheckExpectedStatus?.message}>
          <input className="input" type="number" {...register('healthcheckExpectedStatus')} />
        </Field>
        <Field label="Timeout seconds" error={errors.healthcheckTimeoutSeconds?.message}>
          <input className="input" type="number" {...register('healthcheckTimeoutSeconds')} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="button" onClick={onContinue}>Continue</Button>
      </div>
    </form>
  );
}

function EnvironmentStep({
  onPaste,
  onTemplate,
  onExternal,
}: {
  onPaste: () => void;
  onTemplate: () => void;
  onExternal: () => void;
}) {
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-ink">Environment import</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Option icon={<Upload size={18} />} title="Upload docker-compose.yml" onClick={onPaste} />
        <Option icon={<FileText size={18} />} title="Paste YAML" onClick={onPaste} />
        <Option icon={<CheckCircle2 size={18} />} title="Start from template" onClick={onTemplate} />
        <Option icon={<Play size={18} />} title="Use already running environment" onClick={onExternal} />
        <div className="rounded-md border border-dashed border-border p-4 text-muted">
          <div className="flex items-center gap-2 font-semibold text-ink"><GitBranch size={18} /> Git repository import</div>
          <p className="mt-2 text-sm">Coming later. OAuth and repository cloning are not part of this phase.</p>
        </div>
      </div>
    </div>
  );
}

function ApiImportStep({
  composeYaml,
  analysis,
  yamlError,
  isAnalyzing,
  onAnalyze,
  onComposeChange,
  onContinue,
}: {
  composeYaml: string;
  analysis?: ComposeAnalysisResult;
  yamlError: string | null;
  isAnalyzing: boolean;
  onAnalyze: (composeYaml: string, source: Extract<EnvironmentImportSource, 'UPLOAD' | 'PASTE'>) => void;
  onComposeChange: (composeYaml: string) => void;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-ink">API import</h1>
      <Field label="docker-compose.yml" error={yamlError ?? undefined}>
        <textarea
          className="input min-h-80 font-mono text-sm"
          value={composeYaml}
          onChange={(event) => onComposeChange(event.target.value)}
        />
      </Field>
      <div className="flex flex-wrap gap-3">
        <label className="focus-ring inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-page">
          <Upload size={16} /> Upload YAML
          <input
            className="sr-only"
            type="file"
            accept=".yml,.yaml"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) {
                return;
              }
              void file.text().then((text) => {
                onComposeChange(text);
                onAnalyze(text, 'UPLOAD');
              });
            }}
          />
        </label>
        <Button type="button" disabled={isAnalyzing || !composeYaml.trim()} onClick={() => onAnalyze(composeYaml, 'PASTE')}>
          {isAnalyzing ? 'Analyzing...' : 'Analyze YAML'}
        </Button>
        <Button type="button" variant="secondary" disabled={!analysis} onClick={onContinue}>
          Continue to confirmation
        </Button>
      </div>
      {analysis ? <AnalysisPanel analysis={analysis} /> : null}
    </div>
  );
}

function TemplateStep({
  templates,
  selectedTemplate,
  onSelect,
}: {
  templates: OnboardingTemplate[];
  selectedTemplate?: OnboardingTemplate;
  onSelect: (template: OnboardingTemplate) => void;
}) {
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-ink">Template</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            className={`focus-ring rounded-md border p-4 text-left ${
              selectedTemplate?.id === template.id ? 'border-brand bg-blue-50' : 'border-border bg-white hover:bg-page'
            }`}
            onClick={() => onSelect(template)}
          >
            <h2 className="font-semibold text-ink">{template.name}</h2>
            <p className="mt-2 text-sm text-muted">{template.description}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">{template.environmentType}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function RunStep({
  analysis,
  environmentType,
  project,
  confirmedProject,
  isConfirmed,
  isSaving,
  isRunning,
  onConfirmedChange,
  onBack,
  onSave,
  onRun,
}: {
  analysis?: ComposeAnalysisResult;
  environmentType: EnvironmentConfigType;
  project: OnboardingProjectDraft;
  confirmedProject: Project | null;
  isConfirmed: boolean;
  isSaving: boolean;
  isRunning: boolean;
  onConfirmedChange: (value: boolean) => void;
  onBack: () => void;
  onSave: () => void;
  onRun: () => void;
}) {
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-ink">Confirm and run</h1>
      <section className="rounded-md border border-border p-4">
        <h2 className="font-semibold text-ink">{project.name || 'Untitled project'}</h2>
        <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
          <Info label="Environment" value={environmentType} />
          <Info label="Base URL" value={project.baseUrl} />
          <Info label="Main service" value={project.mainServiceName} />
          <Info label="Healthcheck" value={`${project.healthcheckPath} -> ${project.healthcheckExpectedStatus}`} />
        </dl>
      </section>
      {analysis ? <AnalysisPanel analysis={analysis} /> : null}
      <label className="flex items-start gap-3 rounded-md border border-border p-4 text-sm">
        <input
          className="mt-1"
          type="checkbox"
          checked={isConfirmed}
          onChange={(event) => onConfirmedChange(event.target.checked)}
        />
        <span>I reviewed the detected services, base URL, and all security warnings.</span>
      </label>
      <div className="flex flex-wrap justify-between gap-3">
        <Button type="button" variant="secondary" onClick={onBack}>Back</Button>
        <div className="flex flex-wrap gap-3">
          <Button type="button" disabled={!isConfirmed || isSaving} onClick={onSave}>
            {isSaving ? 'Saving...' : confirmedProject ? 'Save again' : 'Save configuration'}
          </Button>
          <Button type="button" disabled={!confirmedProject || isRunning} onClick={onRun}>
            {isRunning ? 'Starting...' : 'Start first run'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AnalysisPanel({ analysis }: { analysis: ComposeAnalysisResult }) {
  return (
    <section className="space-y-4 rounded-md border border-border bg-page p-4">
      <div>
        <h2 className="font-semibold text-ink">Detected services</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {analysis.services.map((service) => (
            <article key={service.name} className="rounded-md border border-border bg-white p-3">
              <h3 className="font-semibold text-ink">{service.name}</h3>
              <p className="mt-1 text-sm text-muted">{service.image ?? service.buildContext ?? 'No image/build context'}</p>
              <p className="mt-2 text-sm text-muted">Ports: {service.ports.map((port) => `${port.host ?? '-'}:${port.container}`).join(', ') || 'none'}</p>
              <p className="mt-1 text-sm text-muted">Depends on: {service.dependencies.join(', ') || 'none'}</p>
            </article>
          ))}
        </div>
      </div>
      {analysis.probableMainService ? (
        <p className="text-sm text-ink">
          Probable main service: <strong>{analysis.probableMainService.serviceName}</strong> ({Math.round(analysis.probableMainService.confidence * 100)}% confidence)
        </p>
      ) : null}
      {analysis.probableBaseUrl ? <p className="text-sm text-ink">Probable base URL: {analysis.probableBaseUrl}</p> : null}
      {analysis.securityWarnings.length ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <h3 className="flex items-center gap-2 font-semibold"><AlertTriangle size={16} /> Security warnings</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {analysis.securityWarnings.map((warning, index) => (
              <li key={`${warning.code}-${warning.serviceName ?? 'global'}-${index}`}>
                <strong>{warning.severity}</strong> {warning.serviceName ? `${warning.serviceName}: ` : ''}{warning.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Option({ icon, title, onClick }: { icon: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button type="button" className="focus-ring rounded-md border border-border p-4 text-left font-semibold text-ink hover:bg-page" onClick={onClick}>
      <span className="flex items-center gap-2">{icon} {title}</span>
    </button>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-sm text-red-700">{error}</span> : null}
    </label>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}

function stepLabel(step: OnboardingStep): string {
  return {
    project: 'Project',
    environment: 'Environment',
    'api-import': 'API import',
    template: 'Template',
    run: 'Run',
  }[step];
}

function projectFromAnalysis(
  current: OnboardingProjectDraft,
  analysis: ComposeAnalysisResult,
): OnboardingProjectDraft {
  return {
    ...current,
    baseUrl: analysis.probableBaseUrl ?? current.baseUrl,
    mainServiceName: analysis.probableMainService?.serviceName ?? current.mainServiceName,
  };
}

function backendTestYaml(): string {
  return `version: "1.0"
environment:
  type: "external_url"
tests:
  - "./tests/*.yml"
run:
  timeout_minutes: 10
  cleanup: true
`;
}
